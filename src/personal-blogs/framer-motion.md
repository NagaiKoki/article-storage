こんにちは。株式会社スタメンで[FANTS](https://fants.jp/)のフロントエンドを担当している[@0906koki](https://twitter.com/0906koki)です。

皆さんはフロントエンド開発において、アニメーションをどのように実装しているでしょうか？
ちょっとしたものであれば、素の CSS を書いて対応したり、複雑なものであればライブラリを入れて対応するなど、色々やり方はあると思います。

今回の記事は、Framer Motion で始めるアニメーションの実装について書きたいと思います。

## Framer Motion とは

Framer Motion とはデザインツールを提供している framer 社が開発元の React アニメーションライブラリです。
Framer Motion を使えば、タップ時のモーションアニメーションから、状態遷移時のアニメーションまで、簡単に実装できます。
[公式ドキュメント](https://www.framer.com/docs)を見てもらえればよく分かる通り、本当にたくさんの API が提供されており、表現自体も自分の思う通りにできるくらい豊かであるので、基本的にアニメーションを実装する場合には、Framer Motion を使えば事足ります。
例えば、App Store にある様な、カードモーダルの UI も Framer Motion であれば、サクッと実装できてしまいます。

@[codesandbox](https://codesandbox.io/embed/app-store-ui-using-react-and-framer-motion-ecgc2?fontsize=14&hidenavigation=1&theme=dark)

framer 社が開発元ということもありますし、頻繁にメンテナンスされているので、プロダクションで使用することは問題ないと思います。

## 基本的な使い方

まずは基本的な使い方として、タップした時に拡大するアニメーションを実装してみようと思います。（スタイルは styled-jsx を使っていますが、他のスタイリングを使っていても多少異なる部分がありつつも基本的には同じです）

```ts
import { motion } from "framer-motion";
import css from "styled-jsx/css";

export default function Home() {
  return (
    <>
      <div className={`${className} wrapper`}>
        <motion.button whileTap={{ scale: 1.5 }} className={className}>
          クリック
        </motion.button>
      </div>
      {styles}
    </>
  );
}

const { className, styles } = css.resolve`
  .wrapper {
    margin: 100px;
  }
  button {
    border: none;
    border-radius: 8px;
    width: 100px;
    height: 30px;
    background: red;
    color: white;
  }
`;
```

`motion.div`でアニメーション要素を作ることができ、その要素に対してモーションを props で渡します。
ここでは、`whileTap`に`scale: 1.5`を渡すことで、要素をタップしたタイミングで現状の要素の 1.5 倍拡大します。

![](https://storage.googleapis.com/zenn-user-upload/b589e3fcc7d7-20220212.gif)

とても簡単ですね！

また、`scale`の部分を配列要素を渡すことで、一連のキーフレームとして表現することができます。試しに`[0.5, 1.5, 1]`を渡すと、最初 0.5 倍まで縮小され、その後 1.5 倍に拡大し、最後に元に戻るアニメーションを実装できます。

### アンマウント時のアニメーション実装

次にコンポーネントツリーから消えるタイミングでアニメーションを実装する方法について解説します。地味にアンマウント時のアニメーションをやろうとすると難しいですが、Framer Motion を使うと簡単にできちゃいます。

例として、アンマウント時にふわっと消えるモーダルを実装してみましょう。
まずは、以下がコードとなります。

```tsx
import { FC } from "react";
import { AnimatePresence, motion } from "framer-motion";
import css from "styled-jsx/css";

const { className, styles } = css.resolve`
  .overlay {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .wrapper {
    position: absolute;
    left: 50%;
    right: 50%;
    width: 200px;
    height: 200px;
    border-radius: 8px;
    padding: 10px;
    background: #fff;
    z-index: 10;
    transform: translateX(-50%);
  }
`;

type Props = {
  isVisible: boolean;
  onClose: () => void;
};

export const Modal: FC<Props> = ({ isVisible, onClose, children }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={`${className} overlay`} onClick={onClose} />
          <div className={`${className} wrapper`}>{children}</div>
        </motion.div>
      )}
      {styles}
    </AnimatePresence>
  );
};

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <>
      <div className={`${className} wrapper`}>
        <motion.button
          whileTap={{ scale: 1.5 }}
          className={className}
          onClick={() => setIsVisible(true)}
        >
          クリック
        </motion.button>
      </div>
      <Modal isVisible={isVisible} onClose={() => setIsVisible(false)}>
        <div>Modal</div>
      </Modal>
      {styles}
    </>
  );
}
```

![](https://storage.googleapis.com/zenn-user-upload/0903723208fd-20220212.gif)

Modal コンポーネントを作成して、先程作成したボタンコンポーネントのクリックイベント時にモーダルを表示させる簡単な実装となっています。

Modal コンポーネントは`AnimatePresence`でラップしていますが、これがまさにアンマウント時のアニメーションで必要な API となります。

`AnimationPresence`のサブツリーに置かれたコンポーネントは、アンマウントアニメーションの対象になり、一意性のある`key`で区別されます。
また、アンマウント時のアニメーションには`exit`に対して渡すオブジェクトで制御します。今回は opacity を 0 にしているので、ふわっと opacity が 1 から 0 になってアンマウントされていくことになります。

### 子コンポーネントのアニメーションを親コンポーネントが制御

ある汎用的に作られたコンポーネントがあり、そのコンポーネントをいくつかの場所で呼んでいて、それぞれの場所で違ったアニメーションを子コンポーネントで表現したい場合があります。Framer Motion `useAnimation`という hooks が提供されており、`useAnimation`を使って、親コンポーネント側で子コンポーネントのアニメーションを制御します。

例えば、あるボタンコンポーネントがあり、それが 2 箇所の場所で呼ばれて、片方ではクリック時に拡大するボタン、もう片方は回転するアニメーションを実装したい場合を想定します。
先程モーダルを呼び出す時に作ったボタンを、今回作るボタンで置き換えて実装してみましょう。
以下がコードです。

```tsx
import { FC } from "react";
import { AnimationControls, motion } from "framer-motion";
import css from "styled-jsx/css";

const { className, styles } = css.resolve`
  button {
    border: none;
    border-radius: 8px;
    padding: 5px 10px;
    background: red;
    color: #fff;
    font-weight: bold;
  }
`;

type Props = {
  controls: AnimationControls;
  onClick: () => void;
};

export const Button: FC<Props> = ({ controls, onClick, children }) => {
  return (
    <motion.button className={className} onClick={onClick} animate={controls}>
      {children}
      {styles}
    </motion.button>
  );
};
```

```tsx
import { useState } from "react";
import { useAnimation } from "framer-motion";
import css from "styled-jsx/css";

import { Button } from "../src/components/Button";
import { Modal } from "../src/components/Modal";

const { className, styles } = css.resolve`
  .container {
    display: flex;
  }
  .wrapper {
    margin: 100px;
  }
  button {
    border: none;
    border-radius: 8px;
    width: 100px;
    height: 30px;
    background: red;
    color: white;
  }
`;

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const leftControls = useAnimation();
  const rightControls = useAnimation();

  const handleOnLeftClick = () => {
    leftControls.start({
      scale: [0.8, 1.2, 1],
      transition: {
        duration: 0.3,
      },
    });
    setIsVisible(true);
  };

  const handleOnRightClick = () => {
    rightControls.start({
      rotate: 360,
      transition: {
        duration: 0.3,
      },
    });
    setIsVisible(true);
  };

  return (
    <>
      <div className={`${className} container`}>
        <div className={`${className} wrapper`}>
          <Button controls={leftControls} onClick={handleOnLeftClick}>
            クリック
          </Button>
        </div>
        <div className={`${className} wrapper`}>
          <Button controls={rightControls} onClick={handleOnRightClick}>
            クリック
          </Button>
        </div>
      </div>
      {styles}
      <Modal isVisible={isVisible} onClose={() => setIsVisible(false)}>
        <div>Modal</div>
      </Modal>
    </>
  );
}
```

少しコードが長くなりましたが、Home コンポーネントで、`useAnimation`を呼び出している箇所があると思います。
`useAnimation`の返り値である`AnimationControls`型のオブジェクトを子コンポーネントに渡しつつ、親コンポーネント側で start メソッドを使ってアニメーションを制御しています。
このように、子供コンポーネント側でアニメーションを定義するのではなく、親コンポーネント側でアニメーションを制御することで、より汎用性の高いコンポーネントの実装が可能になります。

## バンドルサイズの縮小

最後に Framer Motion のバンドルサイズを小さくする方法について書きたいと思います。
こうしたアニメーションライブラリは何かとサイズが大きくなりがちで、この Framer Motion でいうと、バージョン 6.2.6 時点で、minified + gzip 化している状態で約 42.4KB あります。（minified だけだと、138.7KB）。

基本的に Webpack 等のバンドラーを使っていれば Tree Shaking されるので不要なモジュールはバンドルに含まれませんが、`motion`単体で 25KB ほどあるらしく結構大きいです。そこで、公式では`m`と`LazyMotion`API を提供して、バンドルサイズを減らす方法を提供しています。

使い方としては簡単で、`motion`を使っていた箇所を`m`に置き換えるだけとなります。ただ、`motion`はあらゆる機能をプリロードしていたのに対して、`m`ではプリロードしていないので、ただ置き換えただけだとアニメーションは発火しません。

そこで、アニメーションを使用しているコンポーネントのトップで、`LazyMotion`コンポーネントでラップしてあげて、その`feature`props に、`domAnimation`か`domMax`を渡してあげる必要があります。

```tsx
import { LazyMotion, domAnimation } from "framer-motion";

function App({ children }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
```

`domAnimation`と`domMax`の違いですが、前者が基本的なアニメーションだけが入ったもので、後者がそれにプラスして D&D や Layout Animation が入っています。

アプリケーションの用途に合わせて、どちらを使うか決めることができそうですね。

## 最後に

今回は Framer Motion の基本的な使い方を紹介しました。
Framer Motion は本当にたくさんの API が提供されており、基本的なアニメーションはすべて表現できると思います。
今回の記事ではすべてを伝えきることはできないので、もっと気になる方は[公式ドキュメント](https://www.framer.com/docs)を参照してください。

自分が所属する[FANTS](https://fants.jp/)ではフロントエンドエンジニアを絶賛募集しているので、少しでも気になる方は下記の採用ページを見てみてください！

@[card](https://www.wantedly.com/projects/686600)

ここまで読んで頂きありがとうございました！
