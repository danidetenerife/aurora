import { init } from '@noriginmedia/norigin-spatial-navigation';

let initialized = false;

export const initSpatialNavigation = (): void => {
  if (initialized) {
    return;
  }
  init({
    debug: false,
    visualDebug: false,
  });
  initialized = true;
};
