/**
 * Navegadores falsos para testes de renderização do AppNavigator /
 * MainTabNavigator. O react-navigation real depende de módulos nativos que o
 * projeto 'unit' não tem; estes respeitam o contrato que o app usa: telas
 * declaradas como <X.Screen name>, `navigation.navigate(name, params)` e
 * `route.params`. A primeira tela declarada é a inicial.
 */
import React from 'react';

type ScreenProps = { name: string; children?: unknown; options?: unknown };

function collectScreens(children: React.ReactNode, out: React.ReactElement<ScreenProps>[] = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const el = child as React.ReactElement<ScreenProps & { children?: React.ReactNode }>;
    if (el.type === React.Fragment) collectScreens(el.props.children, out);
    else if (typeof el.props.name === 'string') out.push(el);
  });
  return out;
}

export function createFakeNavigator() {
  const Screen = (_props: ScreenProps) => null;

  function Navigator({ children }: { children?: React.ReactNode }) {
    const screens = collectScreens(children);
    const [current, setCurrent] = React.useState<{ name: string; params?: unknown }>({
      name: screens[0]?.props.name,
    });
    // Como o navegador real: se a rota atual saiu do conjunto (troca de fase),
    // cai na primeira tela declarada.
    const found = screens.find((s) => s.props.name === current.name);
    const screen = found ?? screens[0];
    if (!screen) return null;
    const params = found ? current.params : undefined;
    const navigation = {
      navigate: (name: string, params?: unknown) => setCurrent({ name, params }),
    };
    const render = screen.props.children as
      | ((p: { navigation: typeof navigation; route: { params?: unknown } }) => React.ReactNode)
      | React.ReactNode;
    return (
      <>
        {typeof render === 'function'
          ? render({ navigation, route: { params } })
          : render}
      </>
    );
  }
  return { Navigator, Screen };
}

export const fakeNativeStack = { createNativeStackNavigator: createFakeNavigator };
export const fakeNavigationNative = {
  NavigationContainer: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DarkTheme: { colors: {} },
  DefaultTheme: { colors: {} },
};

/** Abas: renderiza TODAS as telas (cada uma como um bloco rotulado), pois o teste quer ver o conjunto. */
export function createFakeTabs() {
  const Screen = (_props: ScreenProps) => null;
  function Navigator({ children }: { children?: React.ReactNode }) {
    const screens = collectScreens(children);
    return (
      <>
        {screens.map((s) => {
          const render = s.props.children as unknown;
          return (
            <React.Fragment key={s.props.name}>
              {typeof render === 'function' ? (render as () => React.ReactNode)() : (render as React.ReactNode)}
            </React.Fragment>
          );
        })}
      </>
    );
  }
  return { Navigator, Screen };
}
export const fakeBottomTabs = { createBottomTabNavigator: createFakeTabs };
