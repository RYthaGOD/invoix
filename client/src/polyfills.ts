import { Buffer } from "buffer";

if (typeof window !== "undefined") {
    window.Buffer = Buffer;
    window.process = window.process || { env: {} } as any;
    (window as any).global = window;
}

if (typeof globalThis !== "undefined") {
    globalThis.Buffer = Buffer;
    globalThis.process = globalThis.process || { env: {} } as any;
}
