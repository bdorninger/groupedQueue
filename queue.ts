import { Observable, Subject } from 'rxjs';
import { bufferCount, groupBy, map, mergeMap, window } from 'rxjs/operators';

/**
 * Items of a {@link GroupedItemsQueue}. After processing,
 * the queue item is either resolved or rejected - similar to a promise.
 *
 * @export
 * @template T The type of the data load of this item
 * @template R The type of the value that should be used to resolve this item
 */
export interface QueueItem<T, R> {
  data: T;
  resolve(value?: R | PromiseLike<R> | undefined): void;
  reject(reason?: Error): void;
}

/**
 * A group-by function that assigns every item of type T to a group of type G
 */
export type GroupByFn<T, G> = (item: T) => G;

/**
 * A collection of {@link QueueItem}s of the same group of type G. Emitted by a {@link GroupedItemsQueue}.
 */
export interface GroupedItems<T, G, R> {
  group: G;
  items: QueueItem<T, R>[];
}

/**
 * A queue that groups and bufferes items.
 *
 * To create a queue, a grouping-function, and a buffer-size must be specified.
 *
 * To enqueue items, call {@link #enqueue}.
 *
 * To process the grouped and buffered items, subscribe to {@link #groupedItems$}.
 *
 * Item grouping and buffering is done in three steps:
 *
 * 1. All enqeued items are first split into several groups according to the grouping function.
 * 2. Then, they are collected in buffers. There is one buffer per group.
 * 3. Once, a buffer is full or explicitely flushed, the items are emitted per groups in bulk.
 *
 * To explicitely flush all buffers, call {@link #flush}.
 *
 * Note that the subscriber _must_ ensure to either {@link QueueItem#resolve} or {@link QueueItem#reject} all grouped items.
 * Otherwise, there will be Promises left over that wait forever for completion.
 *
 * @export
 * @template T the type of the item to process
 * @template G the type of the groups
 * @template R the type of the result of each processed item
 */
export class GroupedItemsQueue<T, G, R> {
  private queueSubject$?: Subject<QueueItem<T, R>>;
  private readonly flusherSubject$ = new Subject<void>();

  /**
   * Creates an instance of GroupedItemsQueue.
   *
   * @param groupingFn the group-by function that is used to collect the items in groups
   * @param bufferSize the size of the (bulk processing) buffer per group
   */
  constructor(
    private readonly groupingFn: GroupByFn<T, G>,
    private readonly bufferSize: number
  ) {}

  public get groupedItems$(): Observable<GroupedItems<T, G, R>> {
    if (!this.queueSubject$) {
      this.queueSubject$ = new Subject<QueueItem<T, R>>();
    }

    return this.queueSubject$.pipe(
      groupBy((item) => this.groupingFn(item.data)), // separate by group. returns a GroupedObservable per different group
      mergeMap((group$) =>
        group$.pipe(
          window(this.flusherSubject$), // every flush creates a new stream (window)
          mergeMap((window$) => window$.pipe(bufferCount(this.bufferSize))), // buffer items to array
          map((items) => ({ group: group$.key, items })) // map the group key into the result
        )
      )
    );
  }

  /**
   * Enqueues data
   *
   * @param data the data to be enqueued
   * @returns a Promise that will be resolved (or rejected) when the data has been consumed.
   */
  public enqueue(data: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      if (!this.queueSubject$ || this.queueSubject$.closed) {
        reject(new Error('Enqueue disallowed after shutdown of processor'));
      } else {
        this.queueSubject$.next({
          data,
          resolve,
          reject,
        });
      }
    });
  }

  /**
   * Explicitely fluses all buffers. This will immediately start emitting these items in groups.
   */
  public flush() {
    this.flusherSubject$.next();
  }
}
