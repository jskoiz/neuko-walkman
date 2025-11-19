declare module 'ssh2-sftp-client' {
    import { ConnectConfig } from 'ssh2';

    export interface FileInfo {
        type: string;
        name: string;
        size: number;
        modifyTime: number;
        accessTime: number;
        rights: {
            user: string;
            group: string;
            other: string;
        };
        owner: number;
        group: number;
    }

    export default class SftpClient {
        connect(config: ConnectConfig): Promise<void>;
        list(remotePath: string): Promise<FileInfo[]>;
        get(remotePath: string, dst?: string | NodeJS.WritableStream, options?: any): Promise<string | NodeJS.WritableStream | Buffer>;
        put(input: string | Buffer | NodeJS.ReadableStream, remotePath: string, options?: any): Promise<string>;
        mkdir(remotePath: string, recursive?: boolean): Promise<string>;
        rmdir(remotePath: string, recursive?: boolean): Promise<string>;
        delete(remotePath: string): Promise<string>;
        rename(fromPath: string, toPath: string): Promise<string>;
        chmod(remotePath: string, mode: number | string): Promise<string>;
        end(): Promise<void>;
        on(event: string, callback: (...args: any[]) => void): void;
    }
}
