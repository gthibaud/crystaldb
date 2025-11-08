import type { Value } from "../../types";

export interface FileResource extends Value {
    id: string;
    name?: string;
    url?: string;
    size?: number;
    mimeType?: string;
}

export type FilesValue = FileResource[];
