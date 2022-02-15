// Import stylesheets
import { GroupByFn, GroupedItemsQueue } from './queue';
import './style.css';
import {
  queueScheduler,
  asapScheduler,
  asyncScheduler,
  Subject,
  scheduled,
  of,
} from 'rxjs';
import {
  debounce,
  debounceTime,
  delay,
  delayWhen,
  first,
  tap,
} from 'rxjs/operators';

const appDiv: HTMLElement = document.getElementById('app');
appDiv.innerHTML = `<h1>rxjs q</h1>`;

interface Data {
  type: number;
  txt: string;
}

interface GroupedData {
  type: number;
  data: string[];
}

const groupingFn: GroupByFn<Data, number> = (dataArr) => dataArr.type;
/*
asyncScheduler.schedule(() => console.log('async')); // scheduling 'async' first...
asapScheduler.schedule(() => console.log('asap'));
queueScheduler.schedule(() => console.log('queue'));
*/
const q = new GroupedItemsQueue<Data, number, string[]>(groupingFn, 10);

q.groupedItems$.subscribe((item) => {
  console.log(`received`, item); // JSON.stringify(item, undefined, 2));
});

function process(d: Data, immediate = false) {
  q.enqueue(d);
  if (immediate) {
    q.flush();
  }
}

const flusherSubject$ = new Subject<number>();

flusherSubject$
  .pipe(
    tap((n) => console.log(`flush req ${n}`)),
    debounceTime(0, asyncScheduler)
    /*delayWhen((n) =>
      scheduled(of(n).pipe(first()), asapScheduler).pipe(
        tap((n) => console.log(`schedule flush ${n}`))
      )
    )*/
  )
  .subscribe({
    next: (n) => {
      console.log(`flushed ${n}`);
      q.flush();
    },
  });
console.log(`Adding values`);
process({ type: 1, txt: 'foo' });
process({ type: 1, txt: 'bar' }, false);
process({ type: 2, txt: 'hugo' });
process({ type: 2, txt: 'horst' });
process({ type: 2, txt: 'kai' });
console.log(`END Adding values`);
// q.flush();

flusherSubject$.next(1);
flusherSubject$.next(2);
//flusherSubject$.next(3);

// q.enqueue({ type: 1, txt: 'foo' });
//q.enqueue({ type: 2, txt: 'frank' });
//q.enqueue({ type: 2, txt: 'horst' });
//q.enqueue({ type: 2, txt: 'kai' });

/*
queueMicrotask(() => {
  console.log(`mt1`);
  flusherSubject$.next(99);
});
*/
console.log(`Adding MORE values`);
process({ type: 3, txt: 'hugo' });
process({ type: 3, txt: 'karl' });
console.log(`END Adding MORE values`);
setTimeout(() => {
  console.log(`time`);
  flusherSubject$.next(666);
}, 500);
