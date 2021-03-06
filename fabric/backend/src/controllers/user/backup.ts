import { getContract } from '@utils/wallet';
import { PostHandler } from '@constants/types';

export const backup: PostHandler<{ id: string }> = async (req, res, next) => {
    try {
        const { id } = req.params;
        const contract = await getContract('admin1');
        await contract.submitTransaction('backup', id, JSON.stringify(req.body));
        res.json({ ok: true });
    } catch (e) {
        next(e);
    }
};
