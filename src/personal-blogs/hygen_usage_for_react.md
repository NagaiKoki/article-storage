こんにちは、株式会社スタメンでフロントエンドエンジニアをしている [@0906koki](https://twitter.com/0906koki)です。

今回は hygen で雛形の React コンポーネントを生成する方法を書きたいと思います。

## hygen とは

[hygen](https://github.com/jondot/hygen/)とは node.js ベースで作られた、CLI での対話型コード生成ライブラリです。

予めテンプレートを作成しておき、CLI で hygen を起動することで対話的にコードを生成することができるので、毎回同じコードを書く必要がなくなります。

## React コンポーネントを hygen で生成してみる

それぞれのプロジェクトでコード規約や設計が異なっているので、プロジェクトに合ったテンプレートを記述する必要がありますが、今回はあくまでサンプルとして Atomic Design に沿った React コンポーネントの生成とそれに付随する Storybook 用のファイルを生成する方法を書きたいと思います。

### 最終的なイメージ

```
src
 └─ components
     　　　　　　├─ atoms
	│  　　　　└─ Button
        │         ├─ Button.tsx
        │         ├─ Button.stories.tsx
	│	  └─ index.ts
	│   　　　　　　　　
        ├─ molecules
        ├─ organisms
        ├─ templates
	└─ pages
```

### hygen をセットアップ

まずは hygen をインストールして、プロジェクトルートに移動します。

```shell
npm install -g hygen

cd project_root

hygen init self
```

すると、ルート配下に`_templates`という hygen のディレクトリが生成されると思うので、今回は以下のようにディレクトリを編集します。

```
_templates
 └─ generator
     　　　　　　└─ components
             ├─ component.ejs.t
             ├─ component.stories.ejs.t
	     ├─ index.ejs.t
             └─ prompt.js
```

まず初めにどういった対話にするかを決める prompt.js ファイルを編集しましょう。

```js
module.exports = [
  {
    type: "select",
    name: "atomic",
    message: "select directory",
    choices: ["atoms", "molecules", "organisms", "templates", "pages"],
  },
  {
    type: "input",
    name: "component_name",
    message: "input component name",
    validate: (input) => input !== "",
  },
  {
    type: "confirm",
    name: "require_storybook",
    message: "need storybook file？",
  },
];
```

色々記述していますが、以下にそれぞれの key に対する説明です。

- type: 開発者自身が入力する input や選択型の select などがあります
- name: input や select で入力した値が入る変数名となります
- message: 入力する際のメッセージとなります

今回でいうと、まず Atomic Design でのディレクトリ構成にするために、コンポーネントをどこのディレクトリに格納するかを選択させます。
その後に、そのディレクトリに格納するコンポーネントの名前を入力します。（validate で必ず入力させるようにしています）
最後に、yes or no の選択式でそのコンポーネントで storybook ファイルが必要かどうかを選択できるようにします。

prompt.js を編集した後は、それぞれのファイルに雛形となるテンプレートを記述していきます。

```ejs:component.ejs.t
---
to: src/components/<%= atomic %>/<%= h.changeCase.pascal(component_name) %>/<%= h.changeCase.pascal(component_name) %>.tsx
---

import { VFC } from 'react'

type Props = {

}

export const <%= h.changeCase.pascal(name) %>: VFC<Props> = ({}) => {
  return (
    <></>
  )
}
```

```ejs:component.stories.ejs.t
---
to: "<%= require_storybook ? `src/components/${atomic}/${h.changeCase.pascal(component_name)}/${h.changeCase.pascal(component_name)}.stories.tsx` : null %>"
---

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import { <%= h.changeCase.pascal(component_name) %> } from '.';

export default {
  title: '<%= h.changeCase.pascal(atomic) %>/<%= h.changeCase.pascal(component_name) %>',
  component: <%= h.changeCase.pascal(component_name) %>,
} as ComponentMeta<typeof <%= h.changeCase.pascal(component_name) %>>;

const Template: ComponentStory<typeof <%= h.changeCase.pascal(component_name) %>> = () => <<%= h.changeCase.pascal(component_name) %> />;

export const Primary = Template.bind({});
Primary.args = {};
```

```ejs:index.ejs.t
--
to: src/components/<%= atomic %>/<%= h.changeCase.pascal(component_name) %>/index.ts
---
export { <%= h.changeCase.pascal(component_name) %> } from './<%= h.changeCase.pascal(component_name) %>'
```

ejs テンプレートの一番最初に書かれている`to`は、どこのディレクトリに配置するかを決定します。また、prompt.js で決めた変数名はこのテンプレートで使用することができます。

例えば、CLI でディレクトリを atoms, コンポーネント名を Button にすると、`component.ejs.t`のファイルにある、

```ejs
---
to: src/components/<%= atomic %>/<%= h.changeCase.pascal(component_name) %>/<%= h.changeCase.pascal(component_name) %>.tsx
---
```

は、`/src/components/atoms/Button/Button.tsx`に配置される意味となります。

これでセットアップは完了したので、早速コマンドを叩いてファイルを生成してみましょう。

```shell
hygen generator components

? select directory …
 ❯ atoms
   molecules
   organisms
   templates
   pages

? input component name ❯ Button
? need storybook file？ (y/N) ❯ y

Loaded templates: _templates
       added: src/components/atoms/Button/Button.tsx
       added: src/components/atoms/Button/Button.stories.tsx
       added: src/components/atoms/Button/index.ts.
```

無事にコンポーネントが生成されました！

## 最後に

hygen を使うと今まで毎回同じ記述をしていた箇所をまるっと移譲することができます。特に React でコンポーネントを作る際は、css modules や test、storybook 用のファイルを同時に作成するケースがあると思いますが、hygen を使うとコマンド一つで一気に生成できちゃいます。
今回はとてもシンプルな生成方法でしたが、もっと複雑なユースケースに対応できる設定ができるので、よかったら試してみてください！

最後までお読み頂きありがとうございました！
