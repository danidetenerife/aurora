import { LoggerProvider } from '../LoggerProvider';
import { BufferOperationQueue } from './BufferOperationQueue';
import { GapJumpController } from './GapJumpController';
import { MediaSourceAttachment } from './MediaSourceAttachment';
import { RetryPolicy } from './RetryPolicy';
import { RangeFetchFailure, SegmentFetcher } from './SegmentFetcher';
import { SegmentTimeline } from './SegmentTimeline';

const LOOKAHEAD_SECONDS = 30;
const SEEK_PREFETCH_COUNT = 3;

export type MseSessionParts = {
  attachment: MediaSourceAttachment;
  sourceBuffer: SourceBuffer;
  bufferQueue: BufferOperationQueue;
  timeline: SegmentTimeline;
  initSegment: Uint8Array;
  fetcher: SegmentFetcher;
  onSourceInvalid?: () => void;
};

export class MseSession {
  private readonly attachment: MediaSourceAttachment;
  private readonly sourceBuffer: SourceBuffer;
  private readonly bufferQueue: BufferOperationQueue;
  private readonly timeline: SegmentTimeline;
  private readonly initSegment: Uint8Array;
  private readonly fetcher: SegmentFetcher;
  private readonly onSourceInvalid?: () => void;

  private readonly abortController = new AbortController();
  private readonly retryPolicy = new RetryPolicy();
  private readonly gapJump = new GapJumpController();
  private isFetching = false;
  private seekGeneration = 0;

  constructor(parts: MseSessionParts) {
    this.attachment = parts.attachment;
    this.sourceBuffer = parts.sourceBuffer;
    this.bufferQueue = parts.bufferQueue;
    this.timeline = parts.timeline;
    this.initSegment = parts.initSegment;
    this.fetcher = parts.fetcher;
    this.onSourceInvalid = parts.onSourceInvalid;
  }

  private get signal(): AbortSignal {
    return this.abortController.signal;
  }

  async start(audio: HTMLAudioElement): Promise<void> {
    this.gapJump.start(audio, this.sourceBuffer, () =>
      this.onTimeUpdate(audio),
    );

    if (this.timeline.isEmpty) {
      return;
    }

    const initialIndex =
      audio.currentTime > 0
        ? Math.max(0, this.timeline.segmentIndexForTime(audio.currentTime))
        : 0;
    await this.fetchAndAppendSegment(initialIndex);
  }

  dispose(): void {
    this.gapJump.stop();
    this.abortController.abort();
  }

  onStall(audio: HTMLAudioElement): void {
    this.gapJump.poll(audio, this.sourceBuffer.buffered);
  }

  onTimeUpdate(audio: HTMLAudioElement): void {
    if (
      this.signal.aborted ||
      this.retryPolicy.isWaitingToRetry ||
      this.isFetching
    ) {
      return;
    }

    const nextIndex = this.nextSegmentIndexToBuffer(audio.currentTime);
    if (nextIndex === -1) {
      return;
    }

    this.isFetching = true;
    this.fetchAndAppendSegment(nextIndex).finally(() => {
      this.isFetching = false;
      this.onTimeUpdate(audio);
    });
  }

  async onSeeking(audio: HTMLAudioElement): Promise<void> {
    if (this.signal.aborted || this.timeline.isEmpty) {
      return;
    }

    const seekTime = audio.currentTime;
    const targetIndex = this.timeline.segmentIndexForTime(seekTime);
    if (targetIndex === -1 || this.isTimeBuffered(seekTime)) {
      return;
    }

    this.seekGeneration += 1;
    const generation = this.seekGeneration;

    try {
      await this.bufferQueue.enqueue(() =>
        this.sourceBuffer.remove(0, Infinity),
      );
      if (this.signal.aborted || this.seekGeneration !== generation) {
        return;
      }
      this.timeline.clearFetched();

      await this.bufferQueue.enqueue(() =>
        this.sourceBuffer.appendBuffer(this.initSegment.buffer as ArrayBuffer),
      );
    } catch {
      return;
    }

    if (this.signal.aborted || this.seekGeneration !== generation) {
      return;
    }

    const prefetchIndices = [...Array(SEEK_PREFETCH_COUNT).keys()]
      .map((offset) => targetIndex + offset)
      .filter((index) => this.timeline.contains(index));

    await this.fetchSegmentsSequentially(prefetchIndices, generation);
  }

  private nextSegmentIndexToBuffer(currentTime: number): number {
    const { buffered } = this.sourceBuffer;
    if (buffered.length === 0) {
      const targetIndex =
        currentTime > 0
          ? Math.max(0, this.timeline.segmentIndexForTime(currentTime))
          : 0;
      return this.timeline.contains(targetIndex) &&
        !this.timeline.isFetched(targetIndex)
        ? targetIndex
        : -1;
    }

    const bufferedEnd = buffered.end(buffered.length - 1);
    if (bufferedEnd >= currentTime + LOOKAHEAD_SECONDS) {
      return -1;
    }

    return this.timeline.nextUnfetchedIndex(bufferedEnd);
  }

  private isTimeBuffered(time: number): boolean {
    const { buffered } = this.sourceBuffer;
    return [...Array(buffered.length).keys()].some(
      (index) => time >= buffered.start(index) && time < buffered.end(index),
    );
  }

  private async fetchSegmentsSequentially(
    indices: number[],
    generation = this.seekGeneration,
  ): Promise<void> {
    const [head, ...rest] = indices;
    if (
      head === undefined ||
      this.signal.aborted ||
      this.seekGeneration !== generation
    ) {
      return;
    }

    await this.fetchAndAppendSegment(head, generation);
    await this.fetchSegmentsSequentially(rest, generation);
  }

  private async fetchAndAppendSegment(
    segmentIndex: number,
    generation = this.seekGeneration,
  ): Promise<void> {
    const { timeline } = this;

    if (
      !timeline.contains(segmentIndex) ||
      timeline.isFetched(segmentIndex) ||
      this.seekGeneration !== generation
    ) {
      return;
    }

    timeline.markFetched(segmentIndex);

    const appended = await this.fetchAndAppend(segmentIndex, generation);
    if (!appended) {
      if (this.seekGeneration === generation) {
        timeline.unmarkFetched(segmentIndex);
      }
      return;
    }

    if (timeline.isFinal(segmentIndex) && !this.sourceBuffer.updating) {
      this.attachment.endStream();
    }
  }

  private async fetchAndAppend(
    segmentIndex: number,
    generation = this.seekGeneration,
  ): Promise<boolean> {
    const segment = this.timeline.get(segmentIndex);

    const result = await this.fetcher.fetchRange(
      segment.startByte,
      segment.endByte,
      this.signal,
    );
    if (result.kind !== 'ok') {
      if (result.kind !== 'aborted') {
        this.reportFetchFailure(segmentIndex, result);
      }
      return false;
    }

    this.retryPolicy.onFetchSucceeded();

    if (this.signal.aborted || this.seekGeneration !== generation) {
      return false;
    }

    try {
      await this.bufferQueue.enqueue(() =>
        this.sourceBuffer.appendBuffer(result.bytes.buffer as ArrayBuffer),
      );
    } catch {
      return false;
    }

    return true;
  }

  private reportFetchFailure(
    segmentIndex: number,
    failure: RangeFetchFailure,
  ): void {
    if (this.signal.aborted) {
      return;
    }

    const { fatal, message } = this.retryPolicy.onFetchFailed(
      segmentIndex,
      failure,
    );
    void LoggerProvider.get().warn(message);

    if (fatal) {
      this.onSourceInvalid?.();
      this.abortController.abort();
    }
  }
}
