import { randomUUID } from 'node:crypto'
import {
  DiagnosticsSnapshotSchema,
  DiagnosticLogEntrySchema,
  type BuildInfo,
  type DiagnosticLevel,
  type DiagnosticLogEntry,
  type DiagnosticsSnapshot
} from '@shared/contracts'

type Publisher = (channel: string, payload: unknown) => void

export class DiagnosticsService {
  private readonly entries: DiagnosticLogEntry[] = []
  private readonly build: BuildInfo
  private publisher?: Publisher

  constructor(build: BuildInfo) {
    this.build = build
  }

  setPublisher(publisher: Publisher): void {
    this.publisher = publisher
  }

  getSnapshot(): DiagnosticsSnapshot {
    return DiagnosticsSnapshotSchema.parse({
      build: this.build,
      entries: this.entries
    })
  }

  getEntries(): DiagnosticLogEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries.splice(0, this.entries.length)
  }

  log(level: DiagnosticLevel, source: string, message: string, detail?: string): DiagnosticLogEntry {
    const entry = DiagnosticLogEntrySchema.parse({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      detail
    })

    this.entries.unshift(entry)
    if (this.entries.length > 300) {
      this.entries.length = 300
    }

    this.publisher?.('diagnostics:event', entry)
    return entry
  }
}
