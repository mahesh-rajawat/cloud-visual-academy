export interface SimulationProps {
  /** Called with a lab validation id when the learner reaches that state. */
  onLabCheck?: (checkId: string) => void
}
