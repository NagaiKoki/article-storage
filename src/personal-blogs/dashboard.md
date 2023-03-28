## はじめに

こんにちは、株式会社スタメンで FANTS のフロントエンド開発を担当している [@0906koki](https://twitter.com/0906koki) です。
今回の記事では、本日リリースした FANTS ダッシュボードのフロントエンド開発で選定したフレームワークやライブラリ、ディレクトリ構成について解説します。

## FANTS ダッシュボードとは？

FANTS ダッシュボードの説明をする前に、FANTS というプロダクトについて紹介させてください。

[FANTS](https://fants.jp/) とはサブスク型のオンラインファンサロンプラットフォームで、オンラインファンサロンを始めたいオーナー様に、サロン開設に必要なシステム・企画等をワンストップで提供します。現状 100 サロン以上のサロンが開設されており、急成長中のサービスです。

FANTS ダッシュボードは、サロンを開設したオーナー様がサロンに関する様々な設定を行うことができる管理画面のことで、例えばサロンのロゴやユーザー管理の設定がダッシュボード上で行えます。サロンオーナー様が簡単にサロンの設定をできるよう、シンプルで分かりやすい UI・UX が重要です。

![スクリーンショット 2021-11-25 19.17.24.png](https://image.docbase.io/uploads/49d49cb9-aa94-40d9-becf-e1fd0b7955e9.png =300x600)![dashboard_sp_content_list.png](https://image.docbase.io/uploads/6cd06570-f17a-4e12-bf07-83f9a0ba57da.png =300x600)

元々 FANTS は、創業事業である TUNAG のコードをベースにしてスタートしたため、FANTS の管理画面は TUNAG の管理画面のコードに FANTS 特有の機能を追加する形で提供していました。
ただ、TUNAG 独自の仕様が含まれることによる分かりにくさや、フロントエンドを Rails のテンプレートである erb で実装していることによる拡張の難しさ、開発速度の低下などが課題としてあったため、今回 Next.js で新しくリニューアルするプロジェクトをスタートさせました。

バックエンド部分は、既存の Rails の基盤を用いて API と認証を実装しましたが、フロントエンドは別リポジトリで切り出して erb を Next.js で置き換えるために、1 からコンポーネントを実装し、基盤も整える必要がありました。ただ、今までの開発で感じていたフロントエンド開発での痛み（コンポーネント設計や状態管理）を解消できる形で実装できたので、開発者体験としてはとても良かったです。

## 技術スタック

FANTS ダッシュボードでは以下の技術スタックを使用しています。

- フレームワーク : [Next.js](https://nextjs.org/)
- フェッチライブラリ : [SWR](https://swr.vercel.app/ja)
- スタイリング : [Styled-Components](https://styled-components.com/)
- UI 管理 : [Storybook](https://storybook.js.org/)
- 監視 : [Sentry](https://sentry.io/welcome/)
- ホスティング : [Netlify](https://www.netlify.com/)

## Next.js

今回ダッシュボードでは [Next.js](https://nextjs.org/) をフレームワークとして選定しました。選定理由としては、技術的な観点と組織的な観点が挙げられます。

技術的な観点で言うと、Next.js を使用することでフロントエンドのベストプラクティスを実装コストを掛けずとも享受できる点にあります。例えば、コード分割や prefetch は CRA（`create-react-app`）でも実現可能ですが、いざ実装しようと思うとある程度コストを支払う必要があります。一方 Next.js では標準でそうした機能が付随しているので、エンジニアとしてはよりコアな機能開発に焦点を当てることが可能になります。
(その他にも、Next.js にはページごとでレンダリング方式を選択できる利点がありますが、今回のダッシュボードでは認証が必要であるのと、SEO を気にしなくて良いアプリケーションであったので、SSR や SG はせずに CSR しています。)

組織的な観点で言うと、弊社では創業当初から React をフロントエンド技術として使用しており、React に精通しているエンジニアが豊富にいます。Next.js 自体が React のフレームワークであるため、Vue フレームワークである Nuxt.js と比較して、学習コストも低く抑えることができます。

## SWR

[SWR](https://swr.vercel.app/ja)とは React のデータフェッチライブラリであり、サーバーデータの管理が簡単になります。SWR という名前ですが、[stale-while-revalidate](https://datatracker.ietf.org/doc/html/rfc5861)という RFC 5861 で策定された HTTP の Cache-Control のオプションから来ていますが、実際に HTTP の Cache-Control を使っているわけではなく、SWR 内部でそれと似た実装がされています。

例えば、以下のようなコードがあるとします。

```ts
import { VFC } from "react";
import useSWR from "swr";

const fetcher = async () => {
  const res = await fetch(`/api/users`);
  return res;
};

const Users: VFC = () => {
  const { data, error } = useSWR("/users", fetcher);
  if (!data) return <p>loading...</p>;
  if (!!error) return <p>error occurred</p>;

  // ...
};
```

useSWR の第一引数で渡している key（`/users`）があると思いますが、SWR はこの key に対して API のデータをメモリキャッシュします。Users コンポーネントが初回マウントされたタイミングではキャッシュがないので loading fallback を表示しますが、キャッシュがある場合は loading fallback をスキップしてユーザー一覧をレンダリングすることが可能です。

loading fallback をスキップする際に、メモリキャッシュされたデータが古い場合があるので、バックグラウンドで API リクエストを送り、データが更新されていれば mutate してキャッシュも更新し再レンダリングが走ります。

弊社では今まで API のレスポンスデータを Redux で管理していましたが、非同期処理に関わるボイラープレートの実装コストや、上記のようなキャッシュ機構を実装する難しさを課題に感じ、サーバーデータの状態管理として`SWR`を選定しました。また、今回のアプリケーション特性上、真に管理すべきクライアントの状態は少ないことを理由に、クライアントの状態管理としては`useContext` + `useState`を使用しています。

## Styled-Components

[Styled-Components](https://styled-components.com/) は言わずとしれた css-in-js ライブラリです。弊社では Styled-Components を React のスタイリングとして使用してきたこともあり、今回の FANTS ダッシュボードもスタイリングツールとして選定しました。
zero runtime が売りの [Linaria](https://github.com/callstack/linaria) も検討しましたが、JS のランタイムで CSS を生成する css-in-js と比較してどれくらいパフォーマンスが変わるのか不確実だったのと、管理画面という特性上、パフォーマンスがそこまで求められないことも選定から外した理由です。

## Storybook

今回のダッシュボードでは [Storybook](https://storybook.js.org/) を使用して汎用コンポーネント（Button や Modal 等）を管理しています。Storybook を見ることで、すでに実装されているコンポーネントを視覚的に確認できたり、外部環境に依存することなく Storybook 上でコンポーネントが動作するため、コンポーネントの実装がやりやすいなどの利点があります。
ホスティングは [Chromatic](https://www.chromatic.com/) というサービスを使用しており、CI 経由でデプロイしています。

Storybook で管理しているコンポーネントの Visual Regression Testing はまだ出来ていないので、予期せぬ変更を検知するために今後やっていきたいですね。

![スクリーンショット 2021-11-25 21.51.20.png](https://image.docbase.io/uploads/c064d150-0024-4495-a359-93943b85e48c.png =WxH)

## ディレクトリ構成

次に、FANTS ダッシュボードのディレクトリ構成について紹介します。

```
└── src
     ├── apis // Adapter層。外部データとの接続を行う
     ├── assets // 画像ファイルを置く
     ├── components
     │     ├── atoms // 最小のコンポーネントを配置 e.g) Button, Icon, etc...
     │     ├── layouts // 全ページに関わるレイアウトを規定するコンポーネントを配置 e.g) Header, Footer, etc...
     │     ├── molecules // 2つ以上の atoms を組み合わせたコンポーネントを配置 e.g) ActionSheet, Cropper, etc...
     │     ├── organisms // ドメインコンポーネントを配置
     │　    └── templates // ドメインコンポーネントを組み合わせてレイアウトを行う
     │
     ├── config // SWRConfigなどの設定ファイルを配置
     ├── constants // 定数ファイルを配置
     ├── contexts // Context API を配置
     ├── hooks // カスタム hooks を配置
     ├── libs // 外部ライブラリのコンポーネントを配置する層
     ├── pages // Next.js の Page コンポーネントを配置
     ├── types // 型定義ファイルを配置
     └── utils // 汎用的な TypeScript の関数を配置
```

FANTS ダッシュボードでは、上記のディレクトリ構成をしています。各ディレクトリの責務に関してはディレクトリ名の右に書かれている通りですが、依存関係を図に表すと以下の感じになります。

![dashboard_architecture.png](https://image.docbase.io/uploads/43fbeb0e-acc5-47ec-a589-ccaf10a781a3.png =WxH)

それぞれのディレクトリの責務に関して詳しくは説明しませんが、components と apis をピックアップして説明します。

#### components

コンポーネントの設計では Atomic Design での命名規則に則っていますが、責務としては Atomic Design を踏襲しておらず、独自の責務をそれぞれに持たせています。そもそも Atomic Design はインターフェースにおける見た目の粒度を示すものであり、システム的な責務は規定していないためです。

Atoms と Molecules は汎用的なコンポーネントとして、抽象化されて実装されています。例えば Button コンポーネントは Atoms 配下で管理しており、様々なコンテクストから使用されるため、色やローディングの有無、ボタン内の文言は抽象化しています。

Organisms はドメインコンポーネントとして、アプリケーションとしてのコンテクストを持ちます。つまり、ユーザー管理画面のユーザーリストや、ロゴアップロード画面のフォームなど、特定の文脈で使用されるコンポーネントのことです。ここでは、hooks や context の注入を許容し、外部データへのリクエストを行う部分でもありますが、Organisms を Container コンポーネントと Presentational コンポーネントとして分割し、Container コンポーネント側で hooks や context の依存を含めるようにしています。こうすることで、依存が局所的になり変更に強くなるほか、Presentational コンポーネント側はインターフェース（props の型）にだけ依存するようになり、再利用性が高まります。

Templates は Organisms を構成するコンポーネントで、ページのレイアウトを担当し、Pages コンポーネントは Next.js でいう getStaticProps やファイルルーティングとしての責務を持ちます。

今回上記のようなコンポーネント設計で実装を進めましたが、コンポーネント粒度が少し細かすぎる点もあるため、ドメインコンポーネント（Templates と Organisms）と汎用コンポーネント（Atoms と Molecules）という 2 つのディレクトリで分けてしまっても良いかもしれません。特に Templates は Organisms コンポーネントをラップするだけのコンポーネントとなっているため、Templates と Organisms は統合しようと考えています。

#### apis

apis のディレクトリでは、Adapter 層として API などの外部データへアクセスする責務を持ちます。例として、apis ディレクトリは以下のような構造になっています。

```
└── apis
     ├── base.ts // GETやPUTなどの、httpのベース関数を置く
     └── users
           ├── requestFetchUsers.ts // baseの関数を注入してデータにアクセスする
           └── usersMapper.ts // レスポンスで受け取ったデータを整形する
```

今回 axios を使用しているので、base では以下のように axios のインスタンスを使って、GET や POST のリクエストを行うベースの関数を管理しています。また、弊社では JSON:API の形式で API のレスポンスが返却されるので、axios の intercept を使ってデシリアライズとキャメルケースへの変換を行っています。

```ts
const axiosInstance = axios.create({
  // ...
});

axiosInstance.interceptors.response.use(async (response) => {
  return await deserializer(response.data); // deserializerの中でキャメルケースの変換を行っている
});

export const get = async <T>(path: string): Promise<T> => {
  try {
    const response = await axiosInstance.get<T>(path);
    return response.data;
  } catch (e) {
    const error: FetchErrorType = {
      status: e.response.status,
    };
    throw error;
  }
};

// ... 以下POSTやPUTを定義
```

この base で定義した関数を`requestFetchUsers.ts`で import し、ユーザー情報を取得するロジックを書きます。基本的にエンドポイントごとにファイルを分割します。
ここで取得したデータをフロントの世界で扱いやすくするためにマッパー層である`usersMapper.ts`でレスポンスデータを整形しますが、レスポンスが単純な場合はマッパー層を通さずに、API レスポンスの型のまま使用します。

## 最後に

今回の記事では、FANTS ダッシュボードのフロントエンド技術について解説しました。

FANTS ダッシュボードは、今後もサロンオーナー様が FANTS を長く使ってもらうために様々な機能を追加していく必要があります。その過程でフロントエンドの力がますます必要になってくるので、FANTS に興味のある方は下記の採用サイトをご覧になってください。一緒に FANTS を作っていきましょう！

- [フロントエンドエンジニア採用ページ](https://www.wantedly.com/projects/686600)
- [エンジニア採用ページ](https://stmn.co.jp/engineers)

ここまで読んでいただきありがとうございました！
