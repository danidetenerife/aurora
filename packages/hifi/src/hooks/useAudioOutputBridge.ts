import { RefObject, useEffect, useRef } from 'react';

let sharedContext: AudioContext | null = null;
let sharedGainNode: GainNode | null = null;

const getSharedAudioContext = (): { context: AudioContext; gainNode: GainNode } => {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContext();
    sharedGainNode = sharedContext.createGain();
    sharedGainNode.gain.value = 1;
    sharedGainNode.connect(sharedContext.destination);
  }
  return { context: sharedContext, gainNode: sharedGainNode! };
};

export const useAudioOutputBridge = (
  audioRef: RefObject<HTMLAudioElement | null>,
): void => {
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const boundAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio === boundAudioRef.current && sourceNodeRef.current) {
      return;
    }

    const { context, gainNode } = getSharedAudioContext();

    if (context.state === 'suspended') {
      void context.resume();
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // already disconnected
      }
    }

    try {
      const sourceNode = context.createMediaElementSource(audio);
      sourceNode.connect(gainNode);
      sourceNodeRef.current = sourceNode;
      boundAudioRef.current = audio;
    } catch {
      // createMediaElementSource can only be called once per element,
      // if already connected just keep the existing connection
    }
  }, [audioRef]);
};
