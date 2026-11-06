/** Testhjelper: håndlagde poster (RecordSource) uten vault (kun brukt av *.test.ts). */
import { fakeLink, fakeSubject } from '../expression/test-subject';
import type { FakeFile } from '../expression/test-subject';
import { toDisplayValue } from './format-value';
import type { BaseRecord, RecordSource } from './record-source';

export function fakeRecordSource(files: readonly FakeFile[]): RecordSource {
  const records: BaseRecord[] = files.map((spec) => {
    const subject = fakeSubject(spec);
    return { ...subject, displayProperty: (key: string) => toDisplayValue(subject.property(key)) };
  });
  return {
    records: () => records,
    record: (filePath) => records.find((r) => r.filePath === filePath) ?? null,
    resolveLink: (text) => fakeLink(text),
  };
}
