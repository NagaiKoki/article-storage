この度個人ブログを始めました。

一応、wordpress や hatena などは使わずに１から Next.js で開発しました（この文を打っている、マークダウンエディタも）

エンジニアのブログ開発は永遠に公開できないことで有名ですが、僕のその沼に陥りそうでした。（最初は GraphQL サーバー立てて、それを Apollo Client で受け取って...みたいなことをやろうとしてましたが止めました）

技術スタックとしては、

- Next.js（SSG）
- TypeScript
- Chakra
- Supabase みたいな所で作っています。

Next.js の SSG on Vercel、めちゃ早いですね。元々、Rails テンプレートで開発をスタートした自分にとって、Jamstack なサイトを vercel のエッジネットワークを利用した CDN による配信でここまで早くなるのかと驚きです。

あと、Chakra UI による開発もかなり DX が良いです。たいていのコンポーネントが用意されていて、それらのコンポーネントを使えば、たいていの UI は実装できちゃいます。

あと、このブログはダークモードに対応していますが、そのテーマカラーも Chakra なら簡単に対応できます。

```jsx
import { extendTheme } from "@chakra-ui/react";
const config = { initialColorMode: "dark", useSystemColorMode: true };
const theme = extendTheme({ config });
const MyApp = ({ Component, pageProps }) => {
  return (
    <ChakraProvider theme={theme}>
      <Component {...pageProps} />
    </ChakraProvider>
  );
};
```

tailwind + emotion みたいなイメージですかね。
個人的には tailwind よりも chakra の方が css の注入が直感的で書きやすく、コンポーネントの実装がすごく楽なので気に入ってます。

---

このサイトは github で公開しているので、コントリビュートお待ちしています 👨‍🦰

https://github.com/NagaiKoki/blog
