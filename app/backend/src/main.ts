import express, { json, urlencoded } from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

import { PRE } from './utils/pre';
import { Bob } from './utils/bob';
import { randomString } from './utils/random';

dotenv.config();
const PREDAUTH_BACKEND = process.env.PREDAUTH_BACKEND;

if (!PREDAUTH_BACKEND) {
    throw new Error('PREDAUTH_BACKEND not specified');
}

const app = express();
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(session({
    secret: 'F4k3P@ssw0rd',
}));

const pre = new PRE();

const fakeDB: Record<string, Record<string, string>> = {};

void (async () => {
    try {
        await pre.init();
        const { payload: { g, h } } = await (await fetch(`${PREDAUTH_BACKEND}/auth/generators`)).json();
        const bob = new Bob(pre, g, h);

        app.get('/appInfo', (req, res) => {
            if (!req.session) {
                throw new Error('This will never happen');
            }
            const token = randomString();
            req.session.token = token;
            res.json({ pk: bob.pk, data: ['name', 'avatar', 'city', 'bio'], callback: `http://127.0.0.1:4001/decrypt/${token}` });
        });

        app.get('/data', (req, res) => {
            if (!req.session) {
                throw new Error('This will never happen');
            }
            const token: string = req.session.token;
            res.json({ data: fakeDB[token] });
        });

        app.get('/status', (req, res) => {
            if (!req.session) {
                throw new Error('This will never happen');
            }
            const token: string = req.session.token;
            res.json({ loggedIn: !!fakeDB[token] });
        });

        app.post('/decrypt/:token', (req, res) => {
            const token: string = req.params.token;
            const data: Record<string, { data: string; key: { cb0: string; cb1: string }; iv: string }> = req.body;
            fakeDB[token] = Object.values(data)
                .map(({ data, key, iv }) => JSON.parse(bob.reDecrypt(data, key, iv)) as Record<string, string>)
                .reduce((i, j) => ({ ...i, ...j }), {});
            res.sendStatus(200);
        });

        app.listen(4001, '0.0.0.0');

    } catch (e) {
        console.log(e);
    }
})();
