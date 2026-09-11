// Moved to components/common/Timer.tsx so other games (e.g. WordHead) can
// use it without importing from inside Spyfall's own folder. Re-exported
// here so SpyfallGame.tsx's existing import keeps working unchanged.
export { Timer } from "../../components/common/Timer";
