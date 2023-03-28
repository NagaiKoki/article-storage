今回は recoil の API である useRecoilState が返す set◯◯（更新関数）の内部実装を見てみたいと思います。

例として、以下のような atom と useRecoilState を用意します。

```js
const hogeAtom = atom({
  key: "hogeKey",
  default: 1,
});
const [hoge, setHoge] = useRecoilState(hogeAtom);
```

それでは、まず useRecoilState の中を見てみます。

```js
function useRecoilState(recoilState) {
  if (process.env.NODE_ENV !== "production") {
    // $FlowFixMe[escaped-generic]
    validateRecoilValue(recoilState, "useRecoilState");
  }

  return [useRecoilValue(recoilState), useSetRecoilState(recoilState)];
}
```

ここでは、production の以外の環境下の場合にのみ state が正しい型なのかをチェックしているみたいです。

useSetRecoilState の中身を見ると、返しているのが useCallback でメモ化した関数のようです。引数に newValueOrUpdater を受け取るのですが、これは setHoge した時の引数の値ということですね。

その値と、storeRef.current, recoilState を setRecoilValue に渡しています。

```js
function useSetRecoilState(recoilState) {
  if (process.env.NODE_ENV !== "production") {
    // $FlowFixMe[escaped-generic]
    validateRecoilValue(recoilState, "useSetRecoilState");
  }

  const storeRef = useStoreRef$1();
  return useCallback$1(
    (newValueOrUpdater) => {
      setRecoilValue$2(storeRef.current, recoilState, newValueOrUpdater);
    },
    [storeRef, recoilState]
  );
}
```

storeRef.current が何かというと、以下のように contextAPI で作った context オブジェクトみたいです。 その context は初期値に getState などの値を持っています。

```js
const AppContext = react.createContext({
  current: defaultStore,
});

const useStoreRef = () => useContext(AppContext);
function notInAContext() {
  throw new Error(
    "This component must be used inside a <RecoilRoot> component."
  );
}

const defaultStore = Object.freeze({
  getState: notInAContext,
  replaceState: notInAContext,
  getGraph: notInAContext,
  subscribeToTransactions: notInAContext,
  addTransactionMetadata: notInAContext,
});
```

もう一度、useSetRecoilState を見ると、recoilState を渡していいますが、これは、useRecoilState の引数に渡している atom の値となります。

```js
return useCallback$1(
  (newValueOrUpdater) => {
    setRecoilValue$2(storeRef.current, recoilState, newValueOrUpdater);
  },
  [storeRef, recoilState]
);
```

次に setRecoilValue$2 の中身を見てみます。

```js
function setRecoilValue(store, recoilValue, valueOrUpdater) {
  queueOrPerformStateUpdate(store, {
    type: "set",
    recoilValue,
    valueOrUpdater,
  });
}
```

これは、単純に queueOrPerformStateUpdate の関数をラップして関数を実行しているだけです。

queueOrPerformStateUpdate の中身はというと、

```js
function queueOrPerformStateUpdate(store, action) {
  if (batchStack.length) {
    const actionsByStore = batchStack[batchStack.length - 1];
    let actions = actionsByStore.get(store);

    if (!actions) {
      actionsByStore.set(store, (actions = []));
    }

    actions.push(action);
  } else {
    applyActionsToStore(store, [action]);
  }
}

const batchStack = [];
```

割と複雑になってきましたが、単純化して見ると、batchStack.length は最初空配列なので、applyActionsToStore(store, [action]);を見てみます。

```js
function applyActionsToStore(store, actions) {
  store.replaceState((state) => {
    const newState = copyTreeState(state);

    for (const action of actions) {
      applyAction(store, newState, action);
    }

    invalidateDownstreams(store, newState);
    return newState;
  });
}
```

store（context オブジェクト）の replaceState を実行し、詳細はリーディングしていないけど、store を元に新しい state を作成している？

で、作成した新しい state を applyAction に渡して実行。

applyAction を見ると、

```js
function applyAction(store, state, action) {
  if (action.type === 'set') {
    const {
      recoilValue,
      valueOrUpdater
    } = action;
    const newValue = valueFromValueOrUpdater(store, state, recoilValue, valueOrUpdater);
    const writes = setNodeValue$1(store, state, recoilValue.key, newValue);

    for (const [key, loadable] of writes.entries()) {
      writeLoadableToTreeState(state, key, loadable);
    }
  }
  // ...
```

以下の valueFromValueOrUpdater の中を見ると、valueOrUpdater が function でなければ単純に更新する値を返しているみたい。 今回は 100 なので、100 を返す

```js
function valueFromValueOrUpdater(store, state, { key }, valueOrUpdater) {
  if (typeof valueOrUpdater === "function") {
    // Updater form: pass in the current value. Throw if the current value
    // is unavailable (namely when updating an async selector that's
    // pending or errored):
    const current = getNodeLoadable$1(store, state, key);

    if (current.state === "loading") {
      throw new RecoilValueNotReady$1(key);
    } else if (current.state === "hasError") {
      throw current.contents;
    } // T itself may be a function, so our refinement is not sufficient:

    return valueOrUpdater(current.contents); // flowlint-line unclear-type:off
  } else {
    return valueOrUpdater;
  }
}
```

で、次に setNodeValue$1 の中を見ると、以下のような実装になっている。

```js
function setNodeValue(store, state, key, newValue) {
  const node = getNode$1(key);

  if (node.set == null) {
    throw new ReadOnlyRecoilValueError(
      `Attempt to set read-only RecoilValue: ${key}`
    );
  }

  const set = node.set; // so flow doesn't lose the above refinement.

  initializeNodeIfNewToStore(store, state, key, "set");
  return set(store, state, newValue);
}
```

まず、

```js
const node = getNode$1(key);
```

では、getNode$1(key)が nodes という Map オブジェクトから key をキーにして value を取得している。 その nodes は atoms を作成するタイミングで作られるみたいで、

```js
[
  [
    key: "hogeKey",
    value: {
      "key": "hogeKey",
      "shouldRestoreFromSnapshots": true,
      "retainedBy": "recoilRoot",
      "get: getAtom
      "set": setAtom(store, state, newValue)
    }
  ]
]
```

みたいな Map オブジェクト。 setNodeValue では return で value の set 関数を返しているので、setAtom(store, state, newValue)を実行して返すことになる

で、setAtom はというと、return new Map().set(key, loadableWithValue$2(newValue));の記述を見る限り、 key と loadableWithValue で作った新しい値をセットした Map オブジェクトを返している。

```js
function setAtom(_store, state, newValue) {
  // Bail out if we're being set to the existing value, or if we're being
  // reset but have no stored value (validated or unvalidated) to reset from:
  if (state.atomValues.has(key)) {
    const existing = Recoil_nullthrows(state.atomValues.get(key));

    if (existing.state === "hasValue" && newValue === existing.contents) {
      return new Map();
    }
  } else if (
    !state.nonvalidatedAtoms.has(key) &&
    newValue instanceof DefaultValue$2
  ) {
    return new Map();
  }

  if (process.env.NODE_ENV !== "production") {
    if (options.dangerouslyAllowMutability !== true) {
      Recoil_deepFreezeValue(newValue);
    }
  }

  cachedAnswerForUnvalidatedValue = undefined; // can be released now if it was previously in use

  return new Map().set(key, loadableWithValue$2(newValue));
}

// ...
```

```js
function loadableWithValue(value) {
  // Build objects this way since Flow doesn't support disjoint unions for class properties
  return Object.freeze({
    state: "hasValue",
    contents: value,
    ...loadableAccessors,

    getValue() {
      return this.contents;
    },

    toPromise() {
      return Promise.resolve(this.contents);
    },

    valueMaybe() {
      return this.contents;
    },

    valueOrThrow() {
      return this.contents;
    },
  });
}
```

なので、applyAction に戻ると、

```js
const writes = setNodeValue$1(store, state, recoilValue.key, newValue);

for (const [key, loadable] of writes.entries()) {
  writeLoadableToTreeState(state, key, loadable);
}
```

の writes は、setAtoms で返す Map オブジェクトということになる。

で、最後に writeLoadableToTreeState(state, key, loadable);の中身を見ると、

```js
function writeLoadableToTreeState(state, key, loadable) {
  if (
    loadable.state === "hasValue" &&
    loadable.contents instanceof DefaultValue$1
  ) {
    state.atomValues.delete(key);
  } else {
    state.atomValues.set(key, loadable);
  }

  state.dirtyAtoms.add(key);
  state.nonvalidatedAtoms.delete(key);
}
```

で、state の atomsValue に key と loadable を渡して atomsValue を更新しているっぽいです。

まとめ
recoil は Facebook が開発しているということもあり、Redux や Context に代わる第一候補だと思っていますが、まだ試験リリースということで実運用はまだ早そうです。 現状バージョンは 0.3、でロードマップも一見なさそうなので、今後破壊的変更もありそうなのです。本番で使う際はその辺を考慮して導入しないといけないですね。
