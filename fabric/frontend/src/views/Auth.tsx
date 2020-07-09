import React, { ChangeEvent, FC, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { Redirect, RouteComponentProps } from '@reach/router';
import { Button, Card, CardActions, CardContent, CardHeader, Checkbox, FormControlLabel, Typography } from '@material-ui/core';

import { Table } from '../components/Table';
import { Timer } from '../components/Timer';
import { useAlice } from '../hooks/useAlice';
import { useStores } from '../hooks/useStores';
import { useUserData } from '../hooks/useUserData';
import { useUrlParams } from '../hooks/useUrlParams';
import { api } from '../api';
import { UserDataStore } from '../stores';
import { apiWrapper } from '../utils/apiWrapper';
import { encrypt } from '../utils/aliceWrapper';

interface AuthGettingRequest {
    type: 'get';
    id: string;
    pk: string;
    callback: string;
    redirect: string;
    data: string[];
}

interface AuthSettingRequest {
    type: 'set';
    id: string;
    pk: string;
    callback: string;
    redirect: string;
    data: Record<string, string>;
}

type AuthRequest = AuthGettingRequest | AuthSettingRequest;

const AuthGetting = observer<FC<{ request: AuthGettingRequest; }>>(({ request }) => {
    const { identityStore, keyStore, userDataStore, notificationStore } = useStores();
    useUserData();
    const alice = useAlice();
    const [checked, setChecked] = useState<Record<string, boolean | undefined>>({});
    const handleAuth = async () => {
        const data = Object.fromEntries(
            Object.entries(userDataStore.dataGroupedByTag)
                .filter(([, data]) => Object.keys(data).filter((key) => checked[key]).length)
                .map(([tag]) => [tag, alice.reKey(request.pk, keyStore.dataKey[tag].sk)])
        );
        await apiWrapper(
            () => api.reEncrypt(identityStore.id, identityStore.key, request.callback, data),
            '正在提交重加密密钥',
            '成功提交重加密密钥'
        );
        notificationStore.enqueueInfo(<>
            页面将在<Timer time={5} key={performance.now()} onTimeout={() => location.href = request.redirect} />秒后跳转
        </>);
    };

    const handleCheck = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        setChecked((prevChecked) => ({ ...prevChecked, [name]: checked }));
    };
    return <>
        <CardContent>
            <Typography>为应用生成重加密密钥，将您保存在PreDAuth上的数据安全地发送给应用。</Typography>
            <Typography>应用{request.id}想要获取您的如下数据：</Typography>
            {request.data.map((key) => <FormControlLabel
                control={<Checkbox checked={!!checked[key]} disabled={!userDataStore.data[key]} onChange={handleCheck} name={key} />}
                label={key}
                key={key}
            />)}
            <Typography>数据对应的标签将自动勾选</Typography>
            {Object.entries(userDataStore.dataGroupedByTag).map(([tag, data]) => <FormControlLabel
                control={<Checkbox checked={!!Object.keys(data).filter((key) => checked[key]).length} name={tag} />}
                label={tag}
                key={tag}
            />)}
        </CardContent>
        <CardActions>
            <Button onClick={handleAuth} variant='contained' color='primary'>授权</Button>
        </CardActions>
    </>;
});

const AuthSetting = observer<FC<{ request: AuthSettingRequest; }>>(({ request }) => {
    const { userDataStore, identityStore, keyStore, notificationStore } = useStores();
    useUserData();
    const alice = useAlice();
    const deltaDataStore = new UserDataStore(Object.fromEntries(Object.entries(request.data).map(([k, v]) => [k, { value: v, tag: '' }])));
    const handleAuth = async () => {
        deltaDataStore.dataArray.forEach(({ key, value, tag }) => userDataStore.set(key, value, tag));
        const { dataKey, encrypted } = await encrypt(alice, userDataStore.dataArrayGroupedByTag);
        await apiWrapper(async () => {
            await api.setData(identityStore.id, identityStore.key, encrypted);
            await keyStore.set(dataKey);
        }, '正在提交加密数据', '成功加密并提交');
        notificationStore.enqueueInfo(<>
            页面将在<Timer time={5} key={performance.now()} onTimeout={() => location.href = request.redirect} />秒后跳转
        </>);
    };

    return <>
        <CardContent>
            <Typography>应用{request.id}想要更新您的以下数据：</Typography>
            <Table title='更新信息' dataStore={deltaDataStore} />
        </CardContent>
        <CardActions>
            <Button onClick={handleAuth} variant='contained' color='primary'>授权</Button>
        </CardActions>
    </>;
});

export const Auth = observer<FC<RouteComponentProps>>(() => {
    const { identityStore, notificationStore } = useStores();
    const request = useUrlParams<AuthRequest>('request');

    useEffect(() => {
        if (!request) {
            notificationStore.enqueueWarning('授权请求格式错误');
        }
    }, []);

    if (!identityStore.id) {
        return <Redirect to='/' noThrow />;
    }

    switch (request?.type) {
        case 'get':
            return (
                <Card>
                    <CardHeader title='授权获取信息' />
                    <AuthGetting request={request} />
                </Card>
            );
        case 'set':
            return (
                <Card>
                    <CardHeader title='授权更新信息' />
                    <AuthSetting request={request} />
                </Card>
            );
        default:
            return <></>;
    }
});
