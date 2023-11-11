import { create } from 'zustand';

const DEFAULT_STEP = 5;
const DEFAULT_WIDTH = 30;
const DEFAULT_HEIGHT = 15;

type State = {
  generated: boolean;
  stepSize: number;
  width: number;
  height: number;
  maxSize: number;
};

type Actions = {
  setStepSize: (sliderInput: number[]) => void;
  setWidth: (sliderInput: number[]) => void;
  setHeight: (sliderInput: number[]) => void;
  setGenerated: () => void;
};

export const useStore = create<State & Actions>((set) => ({
  generated: false,
  stepSize: DEFAULT_STEP,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  maxSize: 50,
  setStepSize: (sliderInput: number[]) =>
    set((state) => ({
      stepSize: sliderInput[0],
      width: Math.round(state.width / sliderInput[0]) * sliderInput[0],
      height: Math.round(state.height / sliderInput[0]) * sliderInput[0],
      maxSize: Math.round(state.maxSize / sliderInput[0]) * sliderInput[0],
    })),
  setWidth: (sliderInput: number[]) => set(() => ({ width: sliderInput[0] })),
  setHeight: (sliderInput: number[]) => set(() => ({ height: sliderInput[0] })),
  setGenerated: () => set(() => ({ generated: true })),
}));
