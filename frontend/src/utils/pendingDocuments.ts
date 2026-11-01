import { DocumentType, PickedFile } from '../api/documentApi';

export interface QueuedDocument {
  type: DocumentType;
  file: PickedFile;
}

/**
 * Documents chosen on the sign-up form. The account does not exist yet while they are picked, and uploading needs a
 * signed-in user, so they wait here and are sent as soon as the mobile number is verified.
 */
let queued: QueuedDocument[] = [];

export const queueDocuments = (docs: QueuedDocument[]) => { queued = docs; };

export const takeDocuments = (): QueuedDocument[] => {
  const docs = queued;
  queued = [];
  return docs;
};
