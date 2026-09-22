import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Running inside Expo Go: modules that need a development build are unavailable. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
