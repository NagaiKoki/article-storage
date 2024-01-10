こんにちは、株式会社スタメンでオンラインサロンFANTSのフロントエンドエンジニアをしている[@0906koki](https://twitter.com/0906koki)です。

今回はSOLID原則としてある5つの設計原則をReactのコードをベースにして解説できればと思います。

### SOLID原則とは？
SOLID原則とは、ソフトウェアを柔軟に、メンテナンス性を高く設計するための5つの原則となります。
Robert C. Martinによって、5つの原則の頭文字をとってSOLIDという名前が付けられました。5つの原則とは以下の通りです。

1. SRP: 単一責任の原則
2. OCP: 解放閉鎖の原則
3. LSP: リスコフの置換原則
4. ISP: インタフェース分離の原則
5. DIP: 依存性逆転の原則

元々、SOLID原則はJavaなどのオブジェクト指向プログラミングに対して、メンテナンス性の向上や分かりやすいプログラムを担保するために提唱された原則ありますが、オブジェクト指向設計ではないReactに対してもSOLID原則のエッセンスを当てはめることで、スケーラビリティのある設計を担保できると思っています。

Railsなどのフレームワークを使うとRails Wayとしての設計指針が存在するので、ある程度はその道に沿って実装を進めても迷うことはないかもしれません。ただ、ReactではRails Wayのような設計指針がない(公式ドキュメントはあるが)ので、長期的にメンテナンスをしていくアプリケーションを設計する際は、SOLID原則やClean Architectureの理解などが非常に重要だと思っています。

なので、今回は各SOLID原則の5つに対して、Reactのサンプルコードを使って説明をしていきたいと思います。

## SRP (Single Responsibility Principle)

Clean Architecture の中では、SRP とは以下のように述べられています。

> モジュールを変更する理由はたったひとつだけであるべきである。

React に当てはまると、コンポーネントや関数を変更する理由は一つだけであるべきだと置き換えることができます。
理解をしやすくするために、まずは Bad コードを紹介します。

```tsx
import React, { useEffect, useState } from "react";
import axios from "axios";

type TodoType = {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
};

export const TodoList = () => {
  const [data, setData] = useState<TodoType[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    axios
      .get<TodoType[]>("https://jsonplaceholder.typicode.com/todos")
      .then((res) => {
        setData(res.data);
      })
      .catch((e) => {
        console.log(e);
      })
      .finally(() => {
        setIsFetching(false);
      });
  }, []);

  if (isFetching) {
    return <p>...loading</p>;
  }

  return (
    <ul>
      {data.map((todo) => {
        return (
          <li>
            <span>{todo.id}</span>
            <span>{todo.title}</span>
          </li>
        );
      })}
    </ul>
  );
};
```

`TodoList`コンポーネントでは Todo をフェッチしてきて、フェッチしたデータを元にを描画しています。
こういったコンポーネントはプロジェクトに関わっているとたまに見るかもしれませんが、以下の理由で SRP に違反しています。

- フェッチ処理とそれに関わる State 管理, TODO の描画という２つの責務を同じコンポーネントの中で行っている

例えば、fetch 部分で指定しているエンドポイントが変更されたとすると、`TodoList`コンポーネントの中身を変更しないといけません。また、タイトルのスタイルを変更したい場合も、このコンポーネントを変更する必要があります。
なので、変更されるべき理由がこのコンポーネントには複数存在していることになるので、適切に責務を分離してあげる必要があります。幸いにも React ではカスタム hooks を使って、hooks のフェッチ部分とコンポーネントの描画を分離することができるので、カスタム hooks でフェッチ部分を切り出してあげます。

カスタム hooks に切り出してあげたコードが以下のコードです。

```tsx
import React, { useEffect, useState } from "react";
import axios from "axios";

type TodoType = {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
};

export const useFetchTodo = () => {
  const [data, setData] = useState<TodoType[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    axios
      .get<TodoType[]>("https://jsonplaceholder.typicode.com/todos")
      .then((res) => {
        setData(res.data);
      })
      .catch((e) => {
        console.log(e);
      })
      .finally(() => {
        setIsFetching(false);
      });
  }, []);

  return {
    todo: data,
    isFetching,
  };
};

export const TodoList = () => {
  const { todo, isFetching } = useFetchTodo();

  if (isFetching) {
    return <p>...loading</p>;
  }

  return (
    <ul>
      {todo.map((todo) => {
        return (
          <li>
            <span>{todo.id}</span>
            <span>{todo.title}</span>
          </li>
        );
      })}
    </ul>
  );
};
```

こうすることで、フェッチする処理をコンポーネント側が知る必要はなくなり、ただインターフェースを知っているだけでよくなりました。例えば、フェッチの中でエラーハンドリング処理を追加したいケースが出てきても、コンポーネント側を変更せずに`useFetchTodo`の中を変更するだけで収まるようになります。

このように SRP をコンポーネント設計に当てはめることで、適切な責務分離によるテスタビリティの向上や次に解説するオープンクローズドの原則に繋がります。

## OCP (Open Closed Principle)

OCP とは、「コンポーネントや関数の拡張に対しては開いて、変更に対しては閉じているべき」という原則になります。

言葉では分かりづらいと思うので、まずは悪い例をコードを元に説明します。
以下のコードはページのタイトルに使うコンポーネントです。

```tsx
import React, { VFC } from "react";

type Props = {
  title: string;
  type: "default" | "withLinkButton" | "withNormalButton";
  href?: string;
  buttonText?: string;
  onClick?: () => void;
};

export const Title: VFC<Props> = ({
  title,
  type,
  href,
  buttonText,
  onClick,
}) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <h1>{title}</h1>
      {type === "withLinkButton" && (
        <button onClick={onClick}>
          <a href={href}>{buttonText}</a>
        </button>
      )}
      {type === "withNormalButton" && (
        <button onClick={onClick}>{buttonText}</button>
      )}
    </div>
  );
};
```

props としてタイトル名を表示する`title`、タイトルの横にどんなボタンを置くかを決める`type`などを受け取ります。そして現状のユースケースとしては、ボタンを表示しないケース、タイトルの横にリンクのボタンを表示するケース、普通のボタンを表示するケースの 3 つがあります。

なぜコンポーネントは OCP に違反しているのでしょうか？

あるシナリオを考えます。

このコンポーネントを実装したプロダクトをリリースしたとして、幸運にも順調にユーザーに使われるようになってきました。使われる中でプロダクトマネージャーから「タイトルの横にツールチップを表示するページを作って欲しい」（こんな要望あるか分かりませんが）と言われました。

そこで、props の type に`withTooltip`という型を追加して、`type ==== 'withTooltip`の場合はツールチップを表示するように修正しました。

このように、このコンポーネントは拡張を続ける中で常に変更にさらされることになります。常に変更にさらされると、開発者はあるユースケースの追加により、他のユースケースに不具合が出ていないかを確認する必要が出来てきます。この確認作業は拡張の回数と比例して増加していき、エンジニアはこのコンポーネントを変更することが怖くなるはずです。

なので、OCP の原則に従って、リファクタリングをしていきたいと思います。
様々なリファクタリングの仕方がありますが、今回は React のデザインパターンである composition components パターンを使ってリファクタリングします。

以下がリファクタリングしたコードです。

```tsx
import { VFC, FC } from "react";

type TitleProps = {
  title: string;
};

export const Title: FC<TitleProps> = ({ title, children }) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <h1>{title}</h1>
      {children}
    </div>
  );
};

type TitleWithLinkProps = {
  title: string;
  href: string;
  buttonText: string;
};

export const TitleWithLink: VFC<TitleWithLinkProps> = ({
  title,
  href,
  buttonText,
}) => {
  return (
    <Title title={title}>
      <button>
        <a href={href}>{buttonText}</a>
      </button>
    </Title>
  );
};

type TitleWithButtonProps = {
  title: string;
  buttonText: string;
  onClick: () => void;
};

export const TitleWithButtonProps: VFC<TitleWithButtonProps> = ({
  title,
  buttonText,
  onClick,
}) => {
  return (
    <Title title={title}>
      <button onClick={onClick}>{buttonText}</button>
    </Title>
  );
};
```

ユースケースごとにコンポーネントを分割し、`Title`コンポーネントに children として渡すように修正しました。こうすることで、例えば、先程の「ツールチップをタイトルの横に付ける追加修正」に対応する場合も、`TitleWithTooltip`コンポーネントにツールチップを表示するコンポーネントを描画するだけで済みます。他の`TitleWithButton`や`TitleWithLink`コンポーネントに一切影響を与えることはありません。

このリファクタリングによって、`Title`コンポーネントは、拡張に対して開いていて、変更に対しては閉じており、OCP に準拠している設計となりました。

## LSP (Liskov Substitution Principle)

Clean Architecture では LSP とは以下の様に説明されています。

> S 型のオブジェクト o1 の各々に対応する T 型のオブジェクト o2 が 1 つ存在し、T を使って定義されたプログラ?ム P に対して o2 の代わりに o1 を使っても P の振る舞いが変わらない場合、S は T の派生型であると言える。

これはつまり、親クラスが持つメソッドやオブジェクトは、サブクラスで使用しても同じ挙動をしなければいけないというものです。親で定義した仕様を、サブクラスでオーバラーライドして挙動を変えてしまうと、意図しないバグを生むことになります。

例えば`Animal`クラスと、そのサブクラスである`Dog`クラスと`Cat`クラスがあるとして、以下の様なコードは LSP に違反していると言えます。

```ts
export class Animal {
  swim(distance: number) {
    console.log(`${distance}mまで泳いだよ！`);
  }
}

export class Dog extends Animal {
  swim(distance: number) {
    console.log(`${distance}mまで泳いだよ！`);
  }
}

export class Cat extends Animal {
  swim() {
    new Error("猫なので泳げないよ！");
  }
}
```

親クラスである Animal で swim 関数を定義しており、サブクラスである Dog と Cat はその関数をオーバーライドしています。しかし、`Cat`クラスは swim をオーバーライドして独自の処理を加えており、`Cat`クラスは`Animal`クラスと置き換えることはできないので、LSP に違反していると言えます。

React では hooks を使用した関数型コンポーネントが主軸となっており、上記のようなクラスベースの処理を書くことは少なくなっているのが現状です。なので、こちらの原則は React だけしか触らない人にとって頭に入れておくだけでもいいかもしれません。

## ISP (Interface Segregation Principle)

インターフェース分離の原則とは、インターフェースを使用するクラスやオブジェクトは、不要なインターフェースの使用を矯正されるべきではないという原則です。

React で言い換えると、コンポーネントで渡される props のインターフェースは、そのコンポーネントで使用する用途に限定されるべきであると言えます。

例えば以下のようなコードがあるとします。

```tsx
import React, { VFC } from "react";

type PostType = {
  title: string;
  author: {
    name: string;
    age: number;
  };
  createdAt: Date;
};

export const Post = ({ post }: { post: PostType }) => {
  return (
    <div>
      <PostTitle post={post} />
      <span>author: {post.author.name}</span>
      <PostDate post={post} />
    </div>
  );
};

type Props = {
  post: PostType;
};

export const PostTitle: VFC<Props> = ({ post }) => {
  return <h1>{post.title}</h1>;
};

type DateProps = {
  post: PostType;
};

export const PostDate: VFC<DateProps> = ({ post }) => {
  return <time>{post.createdAt}</time>; // サンプルということで...
};
```

`Post`コンポーネントは投稿を描画するコンポーネントで、子コンポーネントにタイトルを表示する`PostTitle`コンポーネントと投稿日を表す`PostDate`コンポーネントを呼び出しています。

一見普通のコンポーネントに見えますが、こちらのコードは ISP に違反しているコードだと言えます。

`PostTitle`コンポーネントはコンポーネントのインターフェースとして`post: PostType`を定義していますが、このコンポーネントで使用するのは`post`オブジェクトの中の`name`プロパティのみです。

つまり、`PostTitle`コンポーネントは`name`というインターフェースにのみ依存していればいいものの、`post: PostType`というインターフェースに依存しているために、不必要な依存まで増やしていることになっています。

`post: PostType`に依存してしまうと、例えば `PostType`が以下のような型に変更された場合、`PostTitle`コンポーネントと`PostDate`コンポーネントにまで変更が及んでしまうことになります。（`name`だけに依存していれば、修正される箇所は`Post`コンポーネントだけに終止します。）

```tsx
import React, { VFC } from "react";

type PostType = {
  basicInfo: {
    title: string;
    createdAt: Date;
  };
  authorInfo: {
    name: string;
    age: number;
  };
};

export const Post = ({ post }: { post: PostType }) => {
  return (
    <div>
      <PostTitle post={post} />
      <span>author: {post.authorInfo.name}</span>
      <PostDate post={post} />
    </div>
  );
};

type Props = {
  post: PostType;
};

export const PostTitle: VFC<Props> = ({ post }) => {
  return <h1>{post.basicInfo.title}</h1>; // 👈 変更
};

type DateProps = {
  post: PostType;
};

export const PostDate: VFC<DateProps> = ({ post }) => {
  return <time>{post.basicInfo.createdAt}</time>; // 👈 変更
};
```

ISP は SRP や OCP とも関連しており、適切にインターフェースを分離できていないと、コンポーネントの責務が一つでなくなり、拡張に対して変更が開いている状態になってしまいます。

なので、以下のように必要なインターフェースだけを定義してあげることで解決できます。

```tsx
import React, { VFC } from "react";

type PostType = {
  title: string;
  author: {
    name: string;
    age: number;
  };
  createdAt: Date;
};

export const Post = ({ post }: { post: PostType }) => {
  return (
    <div>
      <PostTitle title={post.title} />
      <span>author: {post.author.name}</span>
      <PostDate date={post.createdAt} />
    </div>
  );
};

type Props = {
  title: string;
};

export const PostTitle: VFC<Props> = ({ title }) => {
  return <h1>{title}</h1>;
};

type DateProps = {
  date: Date
};

export const PostDate: VFC<DateProps> = ({ date }) => {
  return <time>{date}</time>;
};
```

## DIP (Dependency Inversion Principle)

DIP は日本語で依存性逆転の原則と言います。
所謂、import などを使って外部のモジュールに依存する場合は、具象ではなく抽象に対して依存するべきであるという意味で、SOLID 原則の中で個人的には一番重要な原則であると思っています。

なぜなら、抽象に依存することで変更に強いアプリケーションを構築できるからで、逆に具象に依存したアプリケーションはすぐに破綻してしまいます。

例えば、あなたが所属するチームがフェッチライブラリである[swr](https://swr.vercel.app/ja)を採用したとして、以下のようなコードを実装しました。

```js
import useSWR from 'swr'

const fetcher = async (url) => {
  const res = await fetch(url)
  return res.json()
}

export const Todo = () => {
  const { data } = useSWR('https://jsonplaceholder.typicode.com/todos', fetcher)

  if (!data) return <p>loading....</p>
  
  return (
    <ul>
    {data.map((todo) => {
      return (
        <li>
          <span>{todo.id}</span>
          <span>{todo.title}</span>
        </li>
      );
    })}
  </ul>
  )
}
```

上記のコードはいくつかの問題点を抱えています。

* Todoコンポーネント内でフェッチ処理を行っておりSRPに違反している
* 具体的な実装であるswrにTodoコンポーネントが依存している

今回Todoコンポーネントでは`useSWR`を実行して、todosのデータをフェッチしており、当然Todoコンポーネント以外のコンポーネントも`useSWR`を直接実行してフェッチしています。

例えば、swrの同列ライブラリである[react-query](https://react-query.tanstack.com/)がバージョンアップして、swrより優れた機能をリリースしたとします。あなたはreact-queryにこのアプリケーションも移行したいと考えたときに、果たしてその移行は簡単に行えるでしょうか？ 移行を行うためには以下の問題が発生します。

* 様々なコンポーネントでswrに直接依存しているので、各コンポーネントでreact-queryに置き換える変更を加えないといけない
* エラーの返し方がそれぞれのコンポーネントで異なる場合、`error`を参照している実装箇所も修正が必要になる

その他にも色々問題点はありますが、変更に対して強くないのは間違いないです。

依存関係を表すと以下の通りです。

![](https://storage.googleapis.com/zenn-user-upload/80219528eeabe5eeeaf3a71c.png)


今回の問題として、Todoコンポーネントが直接swrの実装に依存していることが１つの問題点であり、DIPを使って依存の方向性をインターフェースに向けるように修正します。

```ts:useFetch.ts
import useSWR from 'swr'

interface IUseFetch<T> {
  key: string
  fetcher: () => Promise<T>
}

interface IResponse<T> {
  data: T | undefined,
  error: string | undefined
  isValidating: boolean
}

export const useFetch = <T>({ key, fetcher }: IUseFetch<T>): IResponse<T> => {
  const { data, error, isValidating } = useSWR<T, string>(key, fetcher)

  return {
    data,
    error,
    isValidating
  }
}
```

```tsx:Todo.tsx
import { useFetch } from './useFetch'

type ResponseType = {
  id: number
  title: string
}

const fetcher = async (): Promise<ResponseType[]> => {
  const url = 'https://jsonplaceholder.typicode.com/todos'
  const res = await fetch(url)
  return res.json()
}

export const Todo = () => {
  const { data } = useFetch<ResponseType[]>({ key: '/todos', fetcher })

  if (!data) return <p>loading....</p>
  
  return (
    <ul>
    {data.map((todo) => {
      return (
        <li>
          <span>{todo.id}</span>
          <span>{todo.title}</span>
        </li>
      );
    })}
  </ul>
  )
}
```

上記のコードでは、`useFetch`関数というswrをラップする関数を定義して、それをTodoコンポーネントで読み込んでいます。
`useFetch`ではインターフェースとして引数で受け取る値と返却される値を定義しており、Todoコンポーネントでの依存はswr自身から、そのインターフェースに逆転しました。

![](https://storage.googleapis.com/zenn-user-upload/0e04ec16cdcd8ab029c3dc87.png)


このような依存性の逆転で、`useFetch`を呼び出している各コンポーネントは、`useFetch`のインターフェースに対して依存があるだけに変更できたので、react-queryに置き換える場合でも、インターフェースを変えずに`useFetch`の中身をreact-queryで置き換えるだけで、各コンポーネントに何も変更を加えることがなくなります。

これは、OCPともつながっており、OCPを達成するためにはDIPを適切に行う必要があるとも言えそうです。

## さいごに
年々、アプリケーションにおけるフロントエンドの比重が大きくなっており、フロントエンドでもシビアに設計を考える必要が出来てきていますが、今回のようなSOLID原則のエッセンスを用いることで、Reactのアプリケーションをより堅牢でスケーラビリティの高いものにできると思います。

自分が所属するFANTSではフロントエンドエンジニアを絶賛募集しているので、少しでも気になる方は僕にDMなどをくれると嬉しいです！
最後まで読んでいただきありがとうございました。
