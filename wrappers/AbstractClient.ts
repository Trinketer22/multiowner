import { TonClient, TonClient4, HttpApi } from '@ton/ton';
import { Address } from '@ton/core';

type TC4Account = Awaited<ReturnType<TonClient4['getAccount']>>;
type TCAccount  = Awaited<ReturnType<TonClient['getContractState']>>;
type TC4AccountState = TC4Account['account']['state'];
type LastBlock       = Awaited<ReturnType<TonClient4['getLastBlock']>>;

export class AbstractClient {
    #tc4?: TonClient4;
    #tc?: TonClient;

    #convertTCState(account : TCAccount) : TC4AccountState {
        if(account.state == "active") {
            return {
                type: "active",
                code: account.code == null ? null : account.code.toString('base64'),
                data: account.data == null ? null : account.data.toString('base64'),
            }
        }
        else if(account.state == "frozen") {
            return {
                type: "frozen",
                stateHash: ""
            }
        }
        return {
            type: "uninit"
        }
    }
    constructor (client: TonClient | TonClient4) {
        if(client instanceof TonClient4) {
            this.#tc4 = client;
        }
        else {
            this.#tc  = client;
        }
    }
    async getLastBlock() : Promise<LastBlock> {
        if(this.#tc4 !== undefined) {
            return await this.#tc4.getLastBlock();
        }
        else {
            const mcInfo = await this.#tc!.getMasterchainInfo();
            return {
                last:{
                    workchain: mcInfo.workchain,
                    seqno: mcInfo.latestSeqno,
                    shard: mcInfo.shard,
                    fileHash: "",
                    rootHash: ""
                },
                init: {
                    fileHash: "",
                    rootHash: "",
                },
                stateRootHash: "",
                now: Math.floor(Date.now() / 1000)
            }
        }
    }
    async getAccount(blockNum: number, address: Address): Promise<TC4Account> {
        if(this.#tc4 !== undefined) {
            return await this.#tc4.getAccount(blockNum, address);
        }
        const state = await this.#tc!.getContractState(address);
        const converted = this.#convertTCState(state);
        const balance   = {coins: state.balance.toString()}
        const block: TC4Account['block'] = {
            workchain: state.blockId.workchain,
            seqno: state.blockId.seqno,
            shard: state.blockId.shard,
            rootHash: "",
            fileHash: ""
        };
        const last: TC4Account['account']['last'] = state.lastTransaction !== null ? {
            lt: state.lastTransaction.lt,
            hash: state.lastTransaction.hash
        } : null;
        const storage: TC4Account['account']['storageStat'] = {
            duePayment: "",
            lastPaid: 0,
            used: {
                cells: 0,
                bits: 0,
                publicCells: 0
            }
        }
        if(converted.type == "uninit") {
            return {
                account: {
                    balance,
                    state: converted,
                    last: null,
                    storageStat: null
                },
                block
            }
        }
        if(converted.type == "frozen") {
            return {
                account: {
                    balance,
                    state: converted,
                    last,
                    storageStat: storage
                },
                block
            }
        }
        return {
            account: {
                balance,
                state: converted,
                last,
                storageStat: storage 
            },
            block
        }
    }
}
