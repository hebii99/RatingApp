import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTema } from '@/contexts/TemaContext';

export default function AppTabs() {
  const { colores } = useTema();

  return (
    <NativeTabs
      backgroundColor={colores.fondo}
      indicatorColor={colores.tarjeta}
      labelStyle={{ selected: { color: colores.texto } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="historial">
        <NativeTabs.Trigger.Label>Historial</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mis-entregas">
        <NativeTabs.Trigger.Label>Mis entregas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shippingbox.fill" md="local_shipping" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}