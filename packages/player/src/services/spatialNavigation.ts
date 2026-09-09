import { init } from '@noriginmedia/norigin-spatial-navigation';

let initialized = false;

export const initSpatialNavigation = (): void => {
  if (initialized) {
    return;
  }
  initialized = true;

  init({
    debug: false,
    visualDebug: false,
  });
};
