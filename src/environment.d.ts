declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TARGET?: string;
            FOLLOWER?: string;
        }
    }
}

export {};
