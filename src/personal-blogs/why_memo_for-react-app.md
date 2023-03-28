こんにちは、株式会社スタメンでフロントエンドエンジニアをしている[@0906koki](https://twitter.com/0906koki)です。

今回の記事では React を使用する際に、なぜメモ化をする必要があるかについて書きたいと思います。

この記事を書こうかなと思った背景としては、普段 React でコーディングをしている中で、「ここはレンダリングが不要だからメモ化する必要がある」とか「関数が再生成されてしまうから useCallback を使おう」みたいにメモ化していたのですが、そもそもメモ化をすることでどんなメリットがあるのか実感をしていなかったからです。

「たしかにメモ化をすることでレンダリングが抑えられるが、DB によるボトルネックや N+1 などと比較して重要なことなのか？」「レンダリングを抑えることのコストに時間を割くのであれば、別の部分にコストを払った方が費用対効果はあっているのではないか？」などと、メモ化をするコストに疑問を持っていました。

そこで、どのような基準でメモ化を行べきなのかについて個人的な考えを書きたいと思います。

※ メモ化の詳細な説明に関しては、ここでは取り上げません。

## メモ化をする理由

メモ化をする理由は、ひとえにレンダリングコストを下げるためです。

通常 React では state を更新すると、その state を参照しているコンポーネントと子孫のコンポーネントがレンダリングされます。

具体的には、state が更新されると仮想 DOM によるリコンシエーションが走り、リアル DOM に対して変更箇所を反映します。そこの際にブラウザレンダリングが走るのですが、ブラウザレンダリングのフローとして、

1. レンダリングツリー構築
2. リフロー処理
3. リペインティング処理

が行われます。

![](https://storage.googleapis.com/zenn-user-upload/4b1edfc5660ce535455bcd52.png)
[ブラウザの仕組み: 最新ウェブブラウザの内部構造](https://www.html5rocks.com/ja/tutorials/internals/howbrowserswork/)

それぞれ何を行っているか説明すると、

#### レンダリングツリー構築

DOM ツリーと CSSOM ツリーを合わせて視覚上必要となるレンダーツリーを構築します。
head や display: none などの要素はレンダーツリー上からは排除されます。

#### リフロー処理

Viewport 内にある各ノードのサイズや位置を計算する。
Chrome ではレイアウトと言います。

#### リペインティング処理

リフロー処理で算出された各ノードの位置情報などを元に、ブラウザの画面に描画します。リフロー処理を元にするので、リフローが発生すると、リペインティング処理を発生します。

例えば、以下のようなコンポーネントがあるとして、

```jsx
const Parent = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Click Counter</button>
      <span>count: {count}</span>
      <Child1 />
      <Child2 />
    </div>
  );
};

const Child1 = () => {
  return (
    <div>
      <p>child1</p>
    </div>
  );
};

const Child2 = () => {
  return (
    <div>
      <p>child2</p>
    </div>
  );
};
```

Parent コンポーネントにあるボタンをクリックすると以下のフローでレンダリングが走ります。

1. count が更新されて、仮想 DOM のリコンシエーションにより、Parent と Child1, Child2 が差分として検出される
2. 差分のコンポーネントを実際の DOM へ反映する
3. ブラウザのレンダリングツリー構築 ~ リペインティング処理が発生し、実際にブラウザに描画される

1 の差分コンポーネントを実際の DOM へ反映するわけですが、当然差分が大きければ大きいほど、3 のリフロー処理やリペインティング処理にコストが発生するので、これがレンダリングを行うことのコストとなります。また、通常仮想 DOM の差分抽出処理は JavaScript で実行しているので高速ですが、リフローやリペインティング処理はブラウザが実行するため遅くなります。なので一般的にレンダリングコストの文脈で語られるのは、後者のブラウザにおけるレンダリングコストだと思います。

Parent コンポーネントで定義している count という state は Child1 や Child2 では使用しておらず、count を更新したとしても Child1 と Child2 は差分として検出されるべきではありません。差分として検出されないために、以下のようにメモ化を行ってレンダリングを抑えることができます。

```jsx
const Parent = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Click Counter</button>
      <span>count: {count}</span>
      <Child1 />
      <Child2 />
    </div>
  );
};

const Child1 = memo(() => {
  return (
    <div>
      <p>child1</p>
    </div>
  );
});

const Child2 = memo(() => {
  return (
    <div>
      <p>child2</p>
    </div>
  );
});
```

Child1 と Child2 を React の API である memo でコンポーネントをラップすることで、レンダリング前後で渡される props を比較し、差分がなければレンダリングをスキップします。

## 実際にどれくらいメモ化で早くなるのか？

メモ化する場合としない場合とで、どれくらいレンダリング時間に差があるかを計測するために、以下のようなコードを用意して実際に計測してみます。（[github](https://github.com/NagaiKoki/react-performance-measurement)にもコードを上げています。）

```jsx:App.js
import React, { useState, Profiler, memo } from "react";
import Item from './Item'

let num = 10000;
const array = new Array(num).fill(null).map((_, i) => {
  return { id: i, name: `todo: ${i}` };
});

const logTimes = (id, phase, actualTime) => {
  console.log(`${id}'s ${phase} phase:`);
  console.log(`Actual time: ${actualTime}`);
};

export const App = () => {
  const [text, setText] = useState("");

  return (
    <Profiler id="react-pf" onRender={logTimes}>
      <div>
        <h1 style={{ marginBottom: "20px" }}>Performance measurement</h1>
        <input onChange={(e) => setText(e.target.value)} />
        <span style={{ marginBottom: 30 }}>text: {text}</span>
        <ul style={{ display: "flex", flexWrap: "wrap" }}>
          {array.map((item) => {
            return (
              <li style={{ margin: 10 }} key={item.id}>
                <Item name={item.name} />
              </li>
            );
          })}
        </ul>
      </div>
    </Profiler>
  );
};
```

```jsx:Item.jsx
import React, { memo } from "react";

const Item = ({ name }) => {
  return (
    <div
      style={{
        width: "100px",
        height: "100px",
        padding: "1px 10px",
        background: "red",
        listStyle: "none",
        boxShadow: "0px 4px 8px rgba(103, 110, 144, 0.15)",
      }}
    >
      <strong>{name}</strong>
    </div>
  );
};

// export default memo(Item);
export default Item;
```

上記のコードは、親コンポーネントの App と、その子供にあたる Item コンポーネントから構成され、App コンポーネントで大量の Item コンポーネントがレンダリングされるように配列を作ってループさせています。

計測には React の[Profile API](https://ja.reactjs.org/docs/profiler.html)を使っていて、App コンポーネントの input で text を更新して、App と Item コンポーネントがレンダリングされる時間を計測します。

今回は Item コンポーネントで memo API を使って、メモ化した場合としていない場合とでレンダリング時間をそれぞれ計測します。

![](https://storage.googleapis.com/zenn-user-upload/b59d40b61311efd35839dcb2.png)
(input に文字列を入力して、レンダリング時間を計測)

以下がメモ化した場合としていない場合に対する実際にレンダリングした時間の計測結果です。

| Item コンポーネントの数 | 時間（メモ化なし） | 時間（メモ化あり） |
| ----------------------- | ------------------ | ------------------ |
| 10000 個                | 266ms              | 68ms               |
| 5000 個                 | 122ms              | 37ms               |
| 1000 個                 | 30ms               | 10ms               |
| 100 個                  | 10ms               | 3ms                |
| 10 個                   | 2ms                | 1.1ms              |

10000 個の場合は 266ms も掛かっているのに対して、メモ化をすると 1/4 程度の 68ms までレンダリング時間を短縮することができました。

これは体感としてもかなり変化があり、メモ化していない場合は文字を入力した後に実際に反映されるまでとても長くストレスに感じるのに対して、メモ化している場合は即座に反映されるので全くストレスに感じませんでした。

一方で、1000 個以下の場合はメモ化している場合としていない場合とで時間に差異はありましたが、体感としてはどちらも変わりないように感じました。

## 実際にメモ化をするべきなのか？

ここが本当の肝だと思います。Item が 1000 個の場合、メモ化をした場合としない場合とではレンダリング時間に 20ms の差異は出ましたが、体感としては違いを感じ取ることはできませんでした。メモ化を実装することによる実装コストやメモ自体の比較処理のコストと比較して、メモ化をするべきなのでしょうか？

個人的にはレンダリングに 100ms 以上かかる場合はメモ化をするべきだと思いますが、実際の現場で毎回 100ms 以下かどうかを計測するのはコストがかかるので、実際に遅いと感じる、遅くなりそうな実装箇所に対して計測して実際にメモ化するのがいいと思っています。

---

明確にレンダリング時間を 100ms までに抑えるべきだという基準はありませんが、[MDN](https://developer.mozilla.org/en-US/docs/Web/Performance/How_long_is_too_long)では、ユーザーフィードバックの時間は 50ms を目指し、少なくとも 100ms に抑えるべきだと書かれています。

上記の計測の例でもあるように、何かしらのユーザー操作（文字入力やボタンのクリックなど）で 100ms 以上時間かかるのは体感としてかなり遅く感じるので、個人的にも 100ms 以内に抑えるべきだと思います。

---

実際に Item コンポーネントが 1000 個の場合を計測した際に、メモ化した場合としていない場合とで 20ms の差分がありますが、体感としては全く違いは感じられませんでした。
なので、完璧なパフォーマンス最適化を狙うのではなく、遅延を感じる箇所に対してチューニングを行い改善することが良いのではないでしょうか。（メモ化以外にも、コンポーネントの構成を最適化するだけでレンダリングを回避できるケースは沢山あるので、メモ化をする前にまずはそこを検討するべきでしょうが）

個人的には、こうしたレンダリングコスト低減による高いパフォーマンスをユーザーに提供することは勿論大切ですが、ユーザーにとっては、提供するプロダクトのユーザービリティやアクセシビリティの欠如によるストレスの方がよりペインに感じると思うので、フロントエンド領域でのパフォーマンス・チューニングはほどほどにして、ユーザービリティの最適化に時間をかけた方がいい気がしています。

## まとめ

- メモ化を行う理由はレンダリングコストを抑えるため
- Item コンポーネントの例では実際にメモ化をすることによるレンダリング時間の差分を見ることができた
- ただ、大量のコンポーネントのレンダリングにはメモ化によるメリットがあるが、少量のコンポーネントに対するメモ化では体感として違いは感じられない
- 個人的な考えとしては、100ms 以上の遅延を感じる箇所に対してメモ化を行うのが良い
- 毎回 100ms 以上かどうかを計測するのにもコストがかかるので、体感として遅くなりそうか、遅いかを判断軸としてメモ化を行うのでも良いと思う

## 参考

- [ブラウザの仕組み:最新ウェブブラウザの内部構造](https://www.html5rocks.com/ja/tutorials/internals/howbrowserswork/)
- [プロファイラ API](https://ja.reactjs.org/docs/profiler.html)
- [Recommended Web Performance Timings: How long is too long?](https://developer.mozilla.org/en-US/docs/Web/Performance/How_long_is_too_long)

## github

https://github.com/NagaiKoki/react-performance-measurement
