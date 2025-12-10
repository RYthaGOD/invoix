import { Buffer } from "buffer";

// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = window.process || { env: {} };
globalThis.Buffer = Buffer;
