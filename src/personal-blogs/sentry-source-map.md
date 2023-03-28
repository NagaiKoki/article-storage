こんにちは、株式会社スタメンで FANTS の開発をしている[@0906koki](https://twitter.com/0906koki)です。

今回は Next.js のアプリケーションに Sentry を組み込む方法と、ソースマップを送信して Sentry 上でトランスパイル前のコードでエラー箇所を見られる方法について書きたいと思います。

## Sentry とは？

Sentry とは所謂エラートラッキングサービスで、アプリケーション上で発生したエラーの内容、ユーザー、ブラウザ情報等を通知することができるサービスです。類似サービスとしては Bugsnag や Datadog 等がありますね。

React や Vue などは、トランスパイルをして圧縮、難読化された JavaScript のコードに変換すると思いますが、トランスパイル後のコードでエラー発生箇所を通知しても、エラートラックすることは難しいです。
なので、Sentry に対してソースマップファイルを送信し、トランスパイル前のコードでエラートラックできるようにします。

ソースマップについて軽く説明すると、トランスパイル前と後のコードを関連付けるファイルで、以下の様に変換後のファイルにはソースマップの URL が付与されます。

```js
//# sourceMappingURL=framework-4449950695638f171aae.js.map
```

## Sentry のセットアップ

さっそく Sentry のセットアップをしていきます。

まずは`@sentry/nextjs`をインストールします。

```zsh
yarn add @sentry/nextjs
```

次に、sentry の関連ファイルを自動で生成してくれる、wizard コマンドを叩きます。

```zsh
npx @sentry/wizard -i nextjs
```

すると、 以下のファイルが生成されることを確認してください。

- `sentry.client(server).config.js` : クライアントとサーバー環境でエラーを検知するための Sentry 初期化ファイル
- `next.config.js` : next.config.js が存在していれば、\_next.config.js が生成される
- `sentry.properties` : ソースマップの送信などで使用される sentry-cli のための設定ファイル（sentry-cli へのパスなど）
- `.sentryclirc` : sentry-cli を使用するための、auth.token を格納

#### 開発環境以外で送信する

`sentry.client(server).js`の中では DSN が設定されていると思いますが、これは所謂 Sentry SDK に対してどこにエラーを送信するかを明記したものです。なので、以下のように環境変数を使って開発環境ではエラーを送信しないようにします。

```env:.env.production
NEXT_PUBLIC_SENTRY_DSN=hogehoge~
```

```js:sentry.client.js
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
```

#### auth.token を環境変数にセットする

.sentryclirc では auth.token が格納されていると思いますが、この auth.token は秘匿情報なので、ignore して上げる必要があります。（wizard で.gitignore に .sentryclirc 　が追記されていると思います）

なので、本番環境でも auth.token を読み取れるように、`next.config.js`の`SentryWebpackPluginOptions`の authToken に環境変数を指定して、vercel などで環境変数をセットしてあげる必要があります。

```js:next.config.js
const SentryWebpackPluginOptions = {
  // ...
  authToken: process.env.SENTRY_AUTH_TOKEN,
};
```

## Sentry でソースマップを送信する

通常 React などでソースマップを送信する際は、webpack の設定などを色々触らないといけなかったですが、Next.js だと先程実行した wizard コマンドで生成した`next.config.js`に自動でソースマップ送信の設定が記述されているので、特段セットアップが必要ありません。

`next.config.js`を見てみると、`withSentryConfig`を import していると思いますが、これが webpack を拡張するものとなっています。拡張していることとしては、ページのロード時、サーバーが起動したタイミングで`sentry.client(server).js`を実行して Sentry の初期化を行うことや、ソースマップの送信などです。

`withSentryConfig`の内部を見てみると、

```js
export function withSentryConfig(
  userNextConfig: ExportedNextConfig = {},
  userSentryWebpackPluginOptions: Partial<SentryWebpackPluginOptions> = {},
): NextConfigFunction | NextConfigObject {
  // ...
  return {
    ...userNextConfig,
    webpack: constructWebpackConfigFunction(userNextConfig, webpackPluginOptionsWithSources),
  };
}

export function constructWebpackConfigFunction(
  userNextConfig: NextConfigObject = {},
  userSentryWebpackPluginOptions: Partial<SentryWebpackPluginOptions> = {},
): WebpackConfigFunction {
// ...

newConfig.plugins.push(
  // @ts-ignore Our types for the plugin are messed up somehow - TS wants this to be `SentryWebpackPlugin.default`,
  // but that's not actually a thing
  new SentryWebpackPlugin(getWebpackPluginOptions(buildContext, userSentryWebpackPluginOptions)),
);
```

となっており、SentryWebpackPlugin のインスタンスを呼び出していおり、この SentryWebpackPlugin は sentry-cli を使って、build 時にソースマップをアップロードを行います。（開発環境ではソースマップのアップロードは行いません。）

実際に`next build`して、Sentry で見てましょう。

対象プロジェクトの[settings]から[Source Maps]に遷移すると、以下のようにソースマップがアップロードされていることが確認できると思います。

![](https://storage.googleapis.com/zenn-user-upload/107dfc62d611e0039ae73890.png)

これで、Next.js のアプリケーションで以下のように、エラーを発生させるコードを混入させてみます。

```jsx
const Example = () => {
  // ...
  <button
    onClick={() => {
      throw new Error("hoge");
    }}
  >
    button
  </button>;
  // ...
};
```

button をクリックして、Sentry を確認すると、Sentry の[issues]で上記のエラーがトラックされて、トランスパイル前のコードでレポートされていることが確認できると思います。

## 注意点

上記の設定を行ったままでは、トランスパイル前のソースコードが本番環境でも公開されてしまうため、ソースマップファイルをアップロード後に削除する必要があります。

僕の運営している[ブログ](https://kokinagai.com/)試してみました。

Devtool の[Sources]から`_N_E`を見てみると、ソースコードが確認できると思います。

![](https://storage.googleapis.com/zenn-user-upload/53b02372d205d6825ff56128.png)

public なプロジェクトであれば問題ありませんが、private なリポジトリであれば公開したくないと思うので、見えないようにする必要があります。

削除自体は簡単で、`next build`すると`out`ディレクトリに map ファイルが作成されるので、以下のように`next build`後に out ディレクトリ配下の map ファイルを削除してあげます。

```json:package.json
"build": "next build && find ./out -name *.map -delete"
```

## 最後に

Sentry を Next.js に組み込む方法とソースマップのアップロードについて書きました。Sentry はエラートラッキングの他にも webvital に基づいたパフォーマンス監視などができるので、是非様々な観点で活用してみてください。
