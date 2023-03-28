こんにちは。株式会社スタメンで[FANTS](https://fants.jp/)のフロントエンドを担当している[@0906koki](https://twitter.com/0906koki)です。

今回の記事では、皆さんおなじみの Chrome Devtools にある Performance タブで、フロントエンドのパフォーマンスを計測する方法について書きたいと思います。

## はじめに

フロントエンドのパフォーマンス・チューニングと言うとバックエンドと比べて後回しになりがちですが、フロントエンドにアプリケーションの複雑性が寄ってきている現在、フロントエンドがボトルネックでレスポンスのレイテンシーが発生することは往々にしてあると思います。
バックエンドではユーザー数の増加や大量の同時接続に耐えられる負荷対策やパフォーマンス・チューニングが中心となりますが、フロントエンドではプロジェクトサイズの増加による JavaScript ファイルのダウンロードやスクリプティング、レンダリング速度の低下等がパフォーマンスの文脈で語られることが多いです。

直近のフロントエンドの動向を見ると、SG や SSR での初期表示の高速化や React Server Components に見られるクライアントのバンドルサイズ縮小などが挙げられ、それらはフロントエンドのパフォーマンスに大きく寄与してくれます。ただ、そうしたパフォーマンスもプロジェクトが巨大になると徐々に低下していく可能性がある他、上記のようなテクノロジースタックを担当プロジェクトや所属している会社の環境下で使用できないケースは沢山あると思います。

どの文脈においてもですが、パフォーマンスを向上させる上で一番重要なのが、ボトルネックを推測せずに正しく現状を計測することです。（推測するな計測せよという格言があるように）

例えば、自分の担当しているアプリケーションが何か遅いと感じて、手っ取り早い JavaScript ファイルの minify をしたとします。しかし改善されたのは少しだけで、実際に遅くなっている問題は HTML の TTFB で、サーバー処理の最適化や CDN の配置などが解決策だったりします。

なので、正しく計測して現状を把握することが何より大切で、そこで出てきた課題に対するアプローチを考えるのがその次にあります。
正しい計測には [Synthetic monitoring](https://developer.mozilla.org/ja/docs/Glossary/Synthetic_monitoring)である[WebPageTest](https://webpagetest.org/)、[Lighthouse](https://developers.google.com/web/tools/lighthouse/)や、[Real User Monitoring](https://developer.mozilla.org/en-US/docs/Glossary/Real_User_Monitoring)である[datadog](https://www.datadoghq.com/ja/)などがあるので、それらのツールを用いるのが良いと思います。

今回の記事では計測して出てきた課題をより詳細に計測するための Chrome Devtool の Performance の使い方について解説したいと思います。

## 計測環境

- Chrome: 94.0.4606.81

## Performance タブの見方

まずは Chrome Devtools を開きます。計測したサイトの中で右クリックから[検証]をクリックするか、[command] + [shift] + [i] を押すと、以下のように Chrome Devtools が開きます。

Devtools を開くと、右上に Performace タブがあると思うので、今回はそちらをクリックしてパフォーマンスを計測します。

Devtools の Performace でパフォーマンスを計測する上で一番簡単な方法は、下記のエリアにあるページリロードをクリックして計測を開始する方法です。こちらをクリックすると、ページはリロードされ、ページの描画が完全に完了するまでのパフォーマンスを計測することができます。

![](https://storage.googleapis.com/zenn-user-upload/ac8cbe3d84cf-20211117.png)

また、下記の画像で示しているエリアに Network や CPU のスロットリングを設定することができます。

![](https://storage.googleapis.com/zenn-user-upload/04be839a112f-20211117.png)

一般的にエンジニアが使っているマシンは、ユーザーが使用するものより高性能であったり、ネットワークも高速である場合があります。実際のユーザーが使用する環境で計測できるように、スロットリングを使って CPU やネットワークを調整することができます。

### パフォーマンスタブのそれぞれの機能の説明

Performace タブでページのパフォーマンスを計測すると、以下のように CPU 稼働率やネットワークタイムラインなどを見ることができると思います。

![](https://storage.googleapis.com/zenn-user-upload/65ee0d90cec9-20211116.png)

それぞれの見方を説明していきたいと思います。

#### FPS

Frame Per Second と言い、1 秒間にブラウザが何回画面の更新を行ったかのレートとなります。
[MDN](https://developer.mozilla.org/ja/docs/Tools/Performance/Frame_rate) によると、60fps がなめらかなパフォーマンスの目標値であるそうです。Chrome Devtools では、60fps を下回ると、赤色のバーで表示してくれます。

![](https://storage.googleapis.com/zenn-user-upload/9094ed70faa5-20211116.png)

#### CPU

その名の通り、CPU がどれだけ稼働しているかが視覚化されています。
青色が HTML のパース処理等で、黄色が JavaScript の処理、紫色がスタイル計算やレイアウト処理、灰色がアイドル状態を表しています。

![](https://storage.googleapis.com/zenn-user-upload/a5a86f029284-20211116.png)

#### Network

各リソースのネットワーク情報をウォータフォール状で見ることができます。例えば、以下の`bundle.js`のネットワークリクエストを見てみます。

![](https://storage.googleapis.com/zenn-user-upload/d747926600a0-20211117.png)

左上に濃い青色の四角マークがついていると思いますが、これは優先度の高いリクエストを表していて、逆に薄い青色の四角マークは優先度の低いリクエストです。（JavaScript では defer や async を付けると、優先度が低くなります）

またネットワークをよく見ると、以下のように分類されていると思います。

![](https://storage.googleapis.com/zenn-user-upload/954af36c567f-20211116.png)
(https://developer.chrome.com/docs/devtools/evaluate-performance/reference/#network)

- ①: 左端の直線
  - http の通信を始める前にかかる時間
  - DNS ルックアップや TCP ハンドシェイクなどが該当
- ②: 左側の薄い棒
  - TTFB するまでの時間
  - つまり、サーバーがコンテンツを用意する処理 + サーバーからクライアントへネットワークを通じて送信する時間になります
- ③: 右側の濃い棒
  - TTFB からすべてのコンテンツをダウンロードするまでの時間
- ④: 右端の直線
  - メインスレッドが処理するまでの時間

コンテンツのダウンロードを早くするため様々な方法があります。① に関しては、外部リソースに対する対する link に対して、dns-prefetch や preconnect を付けることで、事前に DNS ルックアップや TCP ハンドシェイクを行うやり方があります。
②、③ に関しては、一つがテキストコンテンツを gzip で圧縮して配信するやり方です。サーバー側で大きな JavaScript ファイルや css ファイルを gzip で圧縮することで通信量を減らします。
フロントエンド開発時においても、バンドラーで Tree Shaking を行ったり、できるだけファイルサイズの小さいライブラリを選定する、過剰なトランスパイルを行わないことも、ダウンロード高速化に繋がります。

先程見た`bundle.js`をクリックすると、下の Summary にそのリクエストの詳細（URL や MINE TYPE、ダウンロード時間など）を見ることができます。

![](https://storage.googleapis.com/zenn-user-upload/b54de186085fc0034c746f87.png)

#### Main

メインスレッドでどういったタスクが実行されているかを可視化してくれます。x 軸が時間の経過、y 軸がコールスタックを示しています。
下記の画像を見ると、Network で HTML のダウンロード（①）を行った直後に、HTML のパースをメインスレッドで実行（②）していることが分かります。また、その HTML のパース中に script タグがあれば JavaScript のダウンロード（③）を行っており、下記の画像にはありませんが、③ の後にダウンロードした JavaScript を実行しています。

![](https://storage.googleapis.com/zenn-user-upload/3e45ea83b3933038163452fc.png)

この Main を詳しく見ていきましょう。

以下のようなコードを用意して、Performace で計測してみます。

```jsx
import logo from "./logo.svg";
import React, { useState } from "react";
import "./App.css";

function App() {
  const [display, setDisplay] = useState(false);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <button onClick={() => setDisplay(true)}>click here</button>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
      {display && <p>hoge</p>}
    </div>
  );
}

export default App;
```

button をクリックすると、hoge のテキストが表示される単純なコンポーネントです。
実際にクリックしてみたところを計測してみると、以下のように、Main エリアに`Event: click`とそれを起点とする後続処理が表示されているのが分かると思います。

![](https://storage.googleapis.com/zenn-user-upload/8b099cb25a86ea30b971352a.png)

button をクリックして useState の更新すると、これだけの JavaScript の処理が実行されて、最終的に紫色の部分にある様にレンダリングされて画面に反映されています。

また、この`Event: click`をクリックすると、先程見た Summary タブ等があるエリアが表示されると思います。
Summary の右にある Bottom-Up と Call Tree を見ると、よりそのアクティビティの詳細を見ることができます。

##### Bottom-Up

Bottom-Up では、コールスタックの中でどのアクティビティに一番時間が掛かったのかを見ることができます。
先程の`Event: click`の Bottom-Up は以下の通りです。
![](https://storage.googleapis.com/zenn-user-upload/8c33a1ff5b68-20211117.png)

- Self-Time
  - その処理単体で掛かった時間
- Total-Time
  - その処理とその後続処理以下の合計時間

今回のクリックイベントで時間の掛かっているアクティビティはコンパイル処理とレイアウト処理ということが分かりますね。

##### Call Tree

Call Tree タブでは、ルートアクティビティである先程の`Event`や`Paint`と、その後続処理であるコールスタックを表示することができます。
つまり、クリックイベントからどのような処理が伝播されていくかを辿っていくことができます。先程のクリックイベントでは最終的にレンダリングまで辿っていくことができると思います。

![](https://storage.googleapis.com/zenn-user-upload/bbc50c279745-20211117.png)

## 最後に

今回の記事では Chrome Devtools の使い方について書きました。普段使っている Chrome でこれだけの複雑な計測をできるのはありがたいですね。

ちなみに次回の記事で、今回書いた Chrome Devtools での計測方法を元に、実際にボトルネックを見つけて改善する内容を書きたいと思います。

自分が所属する[FANTS](https://fants.jp/)ではフロントエンドエンジニアを絶賛募集しているので、少しでも気になる方は下記の採用ページを見てみてください！

[フロントエンド採用ページ](https://www.wantedly.com/projects/686600)

最後まで読んでいただきありがとうございました！

## 参考文献

- [Performance features reference](https://developer.chrome.com/docs/devtools/evaluate-performance/reference/)
- [Profiling site speed with the Chrome DevTools Performance tab](https://www.debugbear.com/blog/devtools-performance)
- [Web フロントエンド ハイパフォーマンス チューニング](https://www.amazon.co.jp/dp/B0728K5JZV/ref=dp-kindle-redirect?_encoding=UTF8&btkr=1)
- [Chrome DevTools を用いたメルカリ Web のパフォーマンス計測](https://engineering.mercari.com/blog/entry/2018-12-12-090156/)
