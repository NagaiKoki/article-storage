### 概要

## はじめに

こんにちは。株式会社スタメンで FANTS のエンジニアをしている[@0906koki](https://twitter.com/0906koki)です。

今回の記事では、以前社内で実装した、デシリアライズする前の JSON:API フォーマットの型を、デシリアライズ後の型に変換する方法について書きたいと思います。

## JSON:API

FANTS ではサーバーサイドを Rails で実装しており、その API のシリアライザとして[jsonapi-serializer](https://github.com/jsonapi-serializer/jsonapi-serializer)を使用しています。
例えば、Movie モデルが has_many として Actor モデルを持ち、Movie の title と year、Movie のリレーション先である Actor の name を JSON で返したい場合、以下のようなコードを記述することで、 JSON:API のフォーマットで JSON 返却できます。

##### JSON を返却

```rb
render json: MovieSerializer.new(movie).serializable_hash.to_json
```

##### 返却されるレスポンスの例

```json
{
  "data": {
    "id": "1",
    "type": "movie",
    "attributes": {
      "title": "アナ雪",
      "year": 2013
    },
    "relationships": {
      "actors": {
        "data": [
          {
            "id": "1",
            "type": "actor"
          },
          {
            "id": "2",
            "type": "actor"
          }
        ]
      }
    },
    "included": [
      {
        "id": "1",
        "type": "actor",
        "attributes": {
          "name": "クリステン・ベル"
        }
      },
      {
        "id": "2",
        "type": "actor",
        "attributes": {
          "name": "イディナ・メンゼル"
        }
      }
    ]
  }
}
```

[https://jsonapi.org/](https://jsonapi.org/) に詳しく書かれていますが、JSON:API フォーマットでは、`type` にリソース名、`attributes` にそのリソースのデータ、`relationships` と `included` はリレーション先のリソースデータを返します。

API のレスポンスが上記のような JSON の形で シリアライズされて返却されるため、クライアントサイドではこのフォーマットをデシリアライズして扱いやすい形に変換する必要があります。JavaScript であれば [jsonapi-serializer](https://github.com/SeyZ/jsonapi-serializer)、swift であれば、[Japx](https://github.com/infinum/Japx) など、簡単にデシリアライズできるライブラリが各クライアントに存在するので、基本的にはそれらを通してデシリアライズします。

ちなみに上記の JSON:API フォーマットの JSON データを `jsonapi-serializer` を使ってデシリアライズすると、以下のようなオブジェクトに変換されます。

```ts
const movie = {
  id: "1",
  title: "アナ雪",
  year: 2013,
  actors: [
    {
      id: "1",
      name: "クリステン・ベル",
    },
    {
      id: "2",
      name: "イディナ・メンゼル",
    },
  ],
};
```

## なぜ実装したか

FANTS のフロントエンドでは、上記のように、`jsonapi-serializer`を通して、JSON:API フォーマットのレスポンスデータをデシリアライズしていますが、主に 2 つの観点で、型の安全性の問題がありました。

1. デシリアライズした後のフォーマットを考えて、型を実装する必要がある
2. MSW でモックデータを作成する際、型安全ではないモックデータになる

### 1. デシリアライズ後のフォーマットを考えて、型を実装する必要がある

サーバーサイドが Rails で実装されており、API スキーマの型の自動生成、クライアントとの共有が出来ないので、フロントエンドエンジニアはサーバーサイドエンジニアと連携して、API スキーマを自前で実装する必要があります。この実装においてハブとしているのが、[stoplight](https://stoplight.io/studio) という OpenAPI 定義ファイルを GUI で作成できるツールです。

サーバーサイドエンジニアは、この stoplight 上で API スキーマを定義することで、フロントエンドエンジニアは stoplight を確認してフロントエンドの API レスポンスの型を実装します。

しかし、あくまで stoplight 上で定義されるのはデシリアライズされる前の JSON:API フォーマットであり、フロントエンドエンジニアが実際に使用するのはデシリアライズした型であるため、stoplight 上のスキーマからデシリアライズした型を以下のように自前で実装する必要があります。

```ts
type DeserializedResponseMovieType = {
  id: string;
  title: string;
  year: number;
  actors: {
    id: string;
    name: string;
  }[];
};
```

具体的に言うと、以下は`axios`の例ですが、axios の `interceptors` を使って、レスポンスとして返されるデータを先程上げた `jsonapi-serializer` を通してデシリアライズしており、そのデシリアライズされたデータをアプリケーション内で使うためです。

```ts
axiosInstance.interceptors.response.use(async (response) => {
  // ...
  const deserializedData = await new Deserializer({
    keyForAttribute: "camelCase",
  }).deserialize(response.data);
  return { ...response, data: deserializedData };
});
```

jsonapi-serializer のデシリアライズ処理の返却データの値に型が付けば良いのですが、以下の通り `Promise<any>` で返ってきます。

```ts
export interface Deserializer {
  deserialize(data: any, callback: Callback): void;

  deserialize(data: any): Promise<any>;
}
```

このように、デシリアライズした型を自前で実装するので、その変換した型にミスがある可能性があったり、実装自体にコストもかかるなど、安全性や実装コストの面でデメリットが存在します。

### 2. MSW でモックデータを作成する際、型安全でないモックデータになる

FANTS では、フロントエンドのモックサーバーとして[MSW](https://mswjs.io/) を使用しています。MSW とは Service Worker を立てて、実際に API リクエストがあった際に、それに合致するモックデータをネットワークレベルでインタセプトして返却するライブラリです。
MSW ではテストを書く場合や、実際に API がない場合でもフロントエンドだけ先行して開発したい場合など、様々なシーンで使用していますが、MSW のモックデータは「ネットワークレベルでのモック = デシリアライズする前の JSON:API フォーマットの JSON データ」であるので、以下のように記述しており、型安全ではない状態になっていました。

```ts
const MOVIE_MOCK_DATA = {
  data: {
    id: "1",
    type: "movie",
    attributes: {
      title: "アナ雪",
      year: 2013,
    },
    relationships: {
      actors: {
        data: [
          {
            id: "1",
            type: "actor",
          },
          {
            id: "2",
            type: "actor",
          },
        ],
      },
    },
    included: [
      {
        id: "1",
        type: "actor",
        attributes: {
          name: "クリステン・ベル",
        },
      },
      {
        id: "2",
        type: "actor",
        attributes: {
          name: "イディナ・メンゼル",
        },
      },
    ],
  },
} as const;

export const fetchMovie200Handler = rest.get(
  `/api/v1/movies/:id`,
  (_, res, ctx) => res(ctx.status(200), ctx.json(MOVIE_MOCK_DATA))
);
```

例えば、レスポンスの型に変更があり、1 で書いたデシリアライズした後の型に変更を加えても、上記のモックデータには型が当たっていないので、静的チェックが出来ずコンパイルが通ってしまいます。
デシリアライズする前の型にも型を書けば良いですが、レスポンスのデータに変更があった場合に、デシリアライズした後の型にも変更を加える必要があり 2 重メンテになるため避けたいです。

このように、デシリアライズする前と後でそれぞれ型安全なコードを書く必要があり、またレスポンスの変更に静的チェックで気付けるように、それぞれの型が相互に結びついている必要があります。

## 最終的な型

それらの問題点を解消するために、デシリアライズする前のレスポンスの型を、デシリアライズした型に変換する型を実装ました。

以下が最終的なコードです。

```ts
import {
  SnakeObjectToCamelType,
  ExtractArrayType,
  NarrowUnionObjectType,
} from "@/types/utils";
import {
  BaseJsonApiArrayType,
  BaseJsonApiType,
  BaseRelationshipApiType,
  BaseRelationshipApiArrayType,
} from "./base";

// JSON:API（Relationなし / Metaデータなし）の型変換
export type JsonApiDeserializedType<
  T extends BaseJsonApiType | BaseJsonApiArrayType
> = T extends BaseJsonApiType
  ? SnakeObjectToCamelType<T["data"]["attributes"]> & { id: string }
  : T extends BaseJsonApiArrayType
  ? SnakeObjectToCamelType<
      ExtractArrayType<T["data"]>["attributes"] & { id: string }
    >[]
  : never;

// JSON:API（Relationなし / Metaデータあり）の型変換
export type JsonApiDeserializedWithMetaType<
  T extends BaseJsonApiType | BaseJsonApiArrayType,
  MetaType extends Record<string, unknown>
> = {
  data: JsonApiDeserializedType<T>;
  meta: SnakeObjectToCamelType<MetaType>;
};

// JSON:API（Relationあり / Metaデータなし）の型変換
export type JsonApiRelationshipDeserializedType<
  T extends BaseRelationshipApiType | BaseRelationshipApiArrayType
> = JsonApiDeserializedType<T> &
  (T extends BaseRelationshipApiType
    ? SnakeObjectToCamelType<{
        [K in keyof T["data"]["relationships"]]: SnakeObjectToCamelType<
          NarrowUnionObjectType<
            ExtractArrayType<T["data"]["included"]>,
            "type",
            ExtractArrayType<T["data"]["relationships"][K]["data"]>["type"]
          >["attributes"] & { id: string }
        >[];
      }>
    : T extends BaseRelationshipApiArrayType
    ? SnakeObjectToCamelType<{
        [K in keyof ExtractArrayType<
          T["data"]
        >["relationships"]]: SnakeObjectToCamelType<
          NarrowUnionObjectType<
            ExtractArrayType<ExtractArrayType<T["data"]>["included"]>,
            "type",
            ExtractArrayType<
              ExtractArrayType<T["data"]>["relationships"][K]["data"]
            >["type"]
          >["attributes"] & { id: string }
        >[];
      }>[]
    : never);

// JSON:API（Relationあり / Metaデータあり）の型変換
export type JsonApiRelationshipDeserializedWithMetaType<
  T extends BaseRelationshipApiType | BaseRelationshipApiArrayType,
  MetaType extends Record<string, unknown>
> = {
  data: JsonApiRelationshipDeserializedType<T>;
  meta: SnakeObjectToCamelType<MetaType>;
};
```

```ts
// JSON:APIのベース（Relationなし / dataがObject）の型
export type BaseJsonApiType = {
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
};

// JSON:APIのベース（Relationなし / dataがArray）の型
export type BaseJsonApiArrayType = {
  data: BaseJsonApiType["data"][];
};

// JSON:APIのベース（Relationあり / dataがObject）の型
export type BaseRelationshipApiType<
  MetaType extends Record<string, unknown> = Record<string, unknown>
> = {
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
    relationships: Record<
      string,
      {
        data: {
          id: string;
          type: string;
        }[];
      }
    >;
    included: BaseJsonApiType["data"][];
  };
  meta?: SnakeObjectToCamelType<MetaType>;
};

// JSON:APIのベース（Relationあり / dataがArray）の型
export type BaseRelationshipApiArrayType<
  MetaType extends Record<string, unknown> = Record<string, unknown>
> = {
  data: BaseRelationshipApiType<MetaType>["data"][];
  meta?: BaseRelationshipApiType<MetaType>["meta"];
};
```

```ts
// SnakeCaseをCamelCaseへ変換（string）
export type SnakeStringToCamelCaseType<T extends string> =
  T extends `${infer R}_${infer U}`
    ? `${R}${Capitalize<SnakeStringToCamelCaseType<U>>}`
    : T;

// SnakeCaseをCamelCaseへ変換（object）
export type SnakeObjectToCamelType<T extends Record<string, unknown>> = {
  [K in keyof T as `${SnakeStringToCamelCaseType<
    string & K
  >}`]: T[K] extends Record<string, unknown>
    ? SnakeObjectToCamelType<T[K]>
    : T[K] extends Array<any>
    ? SnakeObjectToCamelType<ExtractArrayType<T[K]>>[]
    : T[K];
};

// NOTE: UnionのObjectから絞り込む
// UnionObject : Union型のObject
// UnionObjectKey : Objectを識別するプロパティ
// UnionObjectKey : 絞り込みたいObjectのUnionObjectKeyの値
export type NarrowUnionObjectType<
  UnionObject extends Record<string, unknown>,
  UnionObjectKey extends keyof UnionObject,
  UnionObjectValue extends UnionObject[UnionObjectKey]
> = UnionObject extends { [Key in UnionObjectKey]: UnionObjectValue }
  ? UnionObject
  : never;

// Array<T>のTを取得
export type ExtractArrayType<T> = T extends (infer U)[] ? U : T;
```

例として、先程のデシリアライズされる前のムービーのレスポンスの型を、以下のように上記の型を通してデシリアライズした型を生成します。

```ts
// デシリアライズする前のJSON:APIフォーマットの型
type RawMovieResponseType = {
  data: {
    id: string;
    type: "movie";
    attributes: {
      title: string;
      year: number;
    };
    relationships: {
      actors: {
        data: {
          id: string;
          type: "actor";
        }[];
      };
    };
    included: {
      id: string;
      type: "actor";
      attributes: {
        name: string;
      };
    }[];
  };
};

// デシリアライズした後の型
type DeserializedMovieResponseType =
  JsonApiRelationshipDeserializedType<RawMovieResponseType>;

// 👇 静的チェックが無事通る
const movie: DeserializedMovieResponseType = {
  id: "1",
  title: "アナ雪",
  year: 2013,
  actors: [
    {
      id: "1",
      name: "クリステン・ベル",
    },
    {
      id: "2",
      name: "イディナ・メンゼル",
    },
  ],
};
```

## 型の説明

まず、FANTS で使用している JSON:API フォーマットとして、大きく分けて 4 つありました。

1. 対象リソースが単一で、リレーションがない場合

   - JSON:API フォーマットで言う、`data` がオブジェクトで、`relationships`, `included` がない場合

2. 対象リソースが複数で、リレーションがない場合

   - JSON:API フォーマットで言う、`data` が配列で、`relationships`, `included` がない場合

3. 対象リソースが単一で、リレーションがある場合

   - JSON:API フォーマットで言う、`data` がオブジェクトで、`relationships`, `included` がある場合

4. 対象リソースが複数で、リレーションがある場合

   - JSON:API フォーマットで言う、`data` が配列で、`relationships`, `included` がある場合

JSON:API フォーマットとしては、`links` やリレーション先が単一リソースである場合 など、上記以外にも様々なエッジケースが想定されますが、FANTS では上記の 4 つが主なユースケースであるため、今回デシリアライズする対象としても 4 つに絞りました。

また、前提として、サーバーサイドで返却される JSON データはスネークケースであり、フロントエンドで扱うフォーマットは基本的にキャメルケースであるので、スネークケースからキャメルケースへ変換する処理も加える必要もあります。

それらを踏まえた上で、まず最初に、1, 2 の「リレーションがない場合」の変換について説明します。

### リレーションがない場合

リレーションがない場合は、以下の型がデシリアライズする型となります。

```ts
export type JsonApiDeserializedType<
  T extends BaseJsonApiType | BaseJsonApiArrayType
> = T extends BaseJsonApiType
  ? SnakeObjectToCamelType<T["data"]["attributes"]> & { id: string }
  : T extends BaseJsonApiArrayType
  ? SnakeObjectToCamelType<
      ExtractArrayType<T["data"]>["attributes"] & { id: string }
    >[]
  : never;
```

リレーションがない場合は単純で、ジェネリクスで JSON:API 形式の型を受け取り、Conditional Types を使って、data がオブジェクトであるか、配列であるかの条件によって分岐しています。
オブジェクトである場合は、`attributes` の型と `id` の型 を intersection して、それらをキャメルケースへ変換しています。キャメルケースへ変換する処理に関しては、Mapped Types の Key Remapping を使ってオブジェクトの Key をスネークケースからキャメルケースへ変換し、それに対応する値は、オブジェクトか配列の場合に Recursive Conditional Types を使って再帰的にスネークケースの key をキャメルケースへ変換しています。

```ts
// SnakeCaseをCamelCaseへ変換（string）
export type SnakeStringToCamelCaseType<T extends string> =
  T extends `${infer R}_${infer U}`
    ? `${R}${Capitalize<SnakeStringToCamelCaseType<U>>}`
    : T;

// SnakeCaseをCamelCaseへ変換（object）
export type SnakeObjectToCamelType<T extends Record<string, unknown>> = {
  [K in keyof T as `${SnakeStringToCamelCaseType<
    string & K
  >}`]: T[K] extends Record<string, unknown>
    ? SnakeObjectToCamelType<T[K]>
    : T[K] extends Array<any>
    ? SnakeObjectToCamelType<ExtractArrayType<T[K]>>[]
    : T[K];
};
```

リソースが複数 (`data`が配列) である場合も基本的には同じです。以下のような、`ExtractArrayType`を定義して、`T["data"]<U>`の U を取得することで、リソースが単一である場合と同じように`T["data"]["attributes"]`と`{ id: string }`を intersection させています。

```ts
type ExtractArrayType<T> = T extends (infer U)[] ? U : T;
```

以下がサンプルデータとなります。

```ts
// デシリアライズする前のJSON:API（Object）フォーマットの型
type RawMovieResponseType = {
  data: {
    id: string;
    type: "movie";
    attributes: {
      title: string;
      year: number;
    };
  };
};

// デシリアライズする前のJSON:API（Array）フォーマットの型
type RawMoviesResponseType = {
  data: {
    id: string;
    type: "movie";
    attributes: {
      title: string;
      year: number;
    };
  }[];
};

// 👇 静的チェックが無事通る
const movie: JsonApiDeserializedType<RawMovieResponseType> = {
  id: '1'
  title: 'アナ雪',
  year: 2013
}

// 👇 静的チェックが無事通る
const movies: JsonApiDeserializedType<RawMoviesResponseType> = {
  id: '1'
  title: 'アナ雪',
  year: 2013
}[]
```

### リレーションがある場合

リレーションがある場合は、以下の型がデシリアライズする型となります。

```ts
export type JsonApiRelationshipDeserializedType<
  T extends BaseRelationshipApiType | BaseRelationshipApiArrayType
> = JsonApiDeserializedType<T> &
  (T extends BaseRelationshipApiType
    ? SnakeObjectToCamelType<{
        [K in keyof T["data"]["relationships"]]: SnakeObjectToCamelType<
          NarrowUnionObjectType<
            ExtractArrayType<T["data"]["included"]>,
            "type",
            ExtractArrayType<T["data"]["relationships"][K]["data"]>["type"]
          >["attributes"] & { id: string }
        >[];
      }>
    : T extends BaseRelationshipApiArrayType
    ? SnakeObjectToCamelType<{
        [K in keyof ExtractArrayType<
          T["data"]
        >["relationships"]]: SnakeObjectToCamelType<
          NarrowUnionObjectType<
            ExtractArrayType<ExtractArrayType<T["data"]>["included"]>,
            "type",
            ExtractArrayType<
              ExtractArrayType<T["data"]>["relationships"][K]["data"]
            >["type"]
          >["attributes"] & { id: string }
        >[];
      }>[]
    : never);
```

リレーションがある場合は、リレーションがない場合と比較してかなり複雑となっています。以下のようなリレーションありの JSON:API フォーマットの型をサンプルとして、順々に説明していきます。

```ts
type RawMovieResponseType = {
  data: {
    id: string;
    type: "movie";
    attributes: {
      title: string;
      year: number;
    };
    relationships: {
      actors: {
        data: {
          id: string;
          type: "actor";
        }[];
      };
      directors: {
        data: {
          id: string;
          type: "director";
        }[];
      };
    };
    included:
      | {
          id: string;
          type: "actor";
          attributes: {
            name: string;
          };
        }[]
      | {
          id: string;
          type: "director";
          attributes: {
            name: string;
          };
        }[];
  };
};
```

まず始めに、リソースの `attributes` を取得する際は、先程見たリレーションがない場合と同じであるので、`JsonApiDeserializedType`を使って取得します。

```ts
export type JsonApiRelationshipDeserializedType<
  T extends BaseRelationshipApiType | BaseRelationshipApiArrayType
> = JsonApiDeserializedType<T>;

const movie: JsonApiRelationshipDeserializedType<RawMovieResponseType> = {
  id: '1'
  title: 'アナ雪',
  year: 2013
}
```

次に、リレーション部分ですが、大枠の方向性としては、`relationships`にある`type`と、`included`にある`type`を突合させて、リレーションとして返す型を決定してあげます。

`data` がオブジェクトの場合ですが、以下のように実装しています。

```ts
// ...
SnakeObjectToCamelType<{
  [K in keyof T["data"]["relationships"]]: SnakeObjectToCamelType<
    NarrowUnionObjectType<
      ExtractArrayType<T["data"]["included"]>,
      "type",
      ExtractArrayType<T["data"]["relationships"][K]["data"]>["type"]
    >["attributes"] & { id: string }
  >[];
}>;
// ...
```

`keyof T['data']['relationships']`で`RawMovieResponseType`の key である`actors`と`directors`のそれぞれを Mapped Types で分配して展開しています。

`NarrowUnionObjectType`の箇所ですが、これが `type` の突合部分ですが、`ExtractArrayType<ExtractArrayType<T['data']>['included']>`で、`included` のユニオン（今回で言うと `included` の `actor` と `director` のユニオン型）を、分配された `K` の `relationships` にある`type`を使って絞り込んでいます。

例えば、`K`が`actors`の場合、以下のように `included` が絞り込まれます。

```ts
type NarrowUnionObjectType<
  UnionObject extends Record<string, unknown>,
  UnionObjectKey extends keyof UnionObject,
  UnionObjectValue extends UnionObject[UnionObjectKey]
> = UnionObject extends { [Key in UnionObjectKey]: UnionObjectValue }
  ? UnionObject
  : never;

NarrowUnionObjectType<
  | {
      id: string;
      type: "actor";
      attributes: {
        name: string;
      };
    }
  | {
      id: string;
      type: "director";
      attributes: {
        name: string;
      };
    },
  "type",
  "actor"
>;

// 👇 typeがactorを持つincludeに絞り込まれる
{
  id: string;
  type: "actor";
  attributes: {
    name: string;
  }
}
```

最後に絞り込んだ `included` の `attributes` と `id` を intersection させたオブジェクトをキャメルケースへ変換し、リレーション先の型を決定しています。

最初に見た対象リソースの `attributes` とリレーション先の intersection させると、リレーションありの場合の型生成が完成します。

```ts
// 👇 最終的に以下のような型になる
SnakeObjectToCamelType<{
  title: string;
  year: number;
}> & {
  id: string;
} & SnakeObjectToCamelType<{
    actors: SnakeObjectToCamelType<
      {
        name: string;
      } & {
        id: string;
      }
    >[];
    directors: SnakeObjectToCamelType<
      {
        name: string;
      } & {
        id: string;
      }
    >[];
  }>;
```

```ts
type ResponseMovieType =
  JsonApiRelationshipDeserializedType<RawResponseMovieType>;

// 👇 静的チェックが通る
const movie: ResponseMovieType = {
  id: "1",
  title: "アナ雪",
  year: 2013,
  actors: [
    {
      id: "1",
      name: "クリステン・ベル",
    },
    {
      id: "2",
      name: "イディナ・メンゼル",
    },
  ],
  directors: [
    {
      id: "1",
      name: "	クリス・バック",
    },
    {
      id: "2",
      name: "	ジェニファー・リー",
    },
  ],
};
```

## 実際に運用してみて

今までは、stoplight 上のレスポンスの型を見て、デシリアライズした型に変換して記述していましたが、今回デシリアライズした型を実装した後では、stoplight 上で記述されている型をそのまま TypeScript の型で書くだけで良くなり直感的になった他、レスポンスの変更があった場合でも、静的チェックでデシリアライズする前と後で矛盾がないかを検知できるようになりました。

しかし、今回書いた型は JSON:API におけるベーシックな部分のみをカバーしたものであるため、今回のデシリアライズ変換でカバーできないエッジケースに対しては随時拡張していく必要があります。

また、stoplight 上で OpenAPI を管理しているため、OpenAPI から自動で TypeScript の型を生成できるようにできれば、Rails API とフロントエンドは、より型安全な API スキーマによって連携できるため、今後検討していきたいです。（OpenAPI がどれくらいの精度で TypeScript の型を生成できるか、運用上のコストを天秤にかけた上で）

## 最後に

今回実装した内容は、github で公開しているので、よりよい書き方がある場合やエッジケースの拡張など、PR お待ちしています！

https://github.com/NagaiKoki/json-api-typescript-deserializer

最後まで読んでいただきありがとうございました！
