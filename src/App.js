import { useState, useEffect } from "react";
import SudokuBoard from "./SudokuBoard/SudokuBoard";
import ControlPanel from "./Controls/ControlPanel";
import DifficultySelector from "./Controls/DifficultySelector";
import SolverStepsAnimation from "./SolverStepsAnimation";
import SudokuApi from "./Api/SudokuApi";

import "./App.css";

/**App for Sudoku Solver
 *
 * State:
 *  - board: current Sudoky board (2d array)
 *  - Solverstatus: indicates if solver is  (running, paused, stopped).
 *  - currentStep: current step for stepping through the solution.
 *  - solverSteps: array of steps solver takes including assignments, conflicts and backtracking
 *  - puzzles: difficulty and puzzle list.
 *  - selectedPuzzle: specific puzzle selected for solving
 *  - highlightedCell: the current cell to be highlighted
 *
 * Props: none
 *
 */
function App() {
  const [board, setBoard] = useState([]);
  const [solverStatus, setSolverStatus] = useState("stopped");
  const [highlightedCell, setHighlightedCell] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [solverSteps, setSolverSteps] = useState([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState({
    difficulty: "",
    filename: "",
  });
  const [puzzles, setPuzzles] = useState({ easy: [], medium: [], hard: [] });

  const paragraph = `This is a Sudoku solver that employs the Conflict-Driven Clause Learning (CDCL) algorithm, traditionally used in computational logic for solving Boolean satisfiability problems.
   It simplifies puzzles through unit propagation, strategically selects cells using minimum remaining values and degree heuristics, and minimizes conflicts by choosing the least constraining values. 
   The solver learns from past conflicts to avoid future dead ends, efficiently finding the best path to solve the puzzle.`;

  /**gets puzzle text file from api */
  const loadPuzzle = async (difficulty, puzzleId) => {
    try {
      const res = await SudokuApi.initializeBoard(difficulty, puzzleId);

      setBoard(res.board);
      setSelectedPuzzle({ difficulty, filename: puzzleId });
      setSolverStatus("stopped");
      setCurrentStep(null);
    } catch (err) {
      console.error("failed to load puzzle", err);
    }
  };

  /**gets puzzle txt file based on file name and solves */
  const fetchAndSetSolverSteps = async (selectedPuzzle) => {
    try {
      // setSolverStatus('running');
      const { difficulty, filename } = selectedPuzzle;
      const res = await SudokuApi.getActions(difficulty, filename);
      setSolverSteps(res.steps || []);
    } catch (err) {
      console.error("failed to solve puzzle", err);
      setSolverStatus("stopped");
    }
  };

  /**updates board and current step */
  const updateBoardAndStep = (newStep) => {
    const currentSolverStep = solverSteps[newStep];

    const { actionType, row, col, boardState, reason } = currentSolverStep;

    if (boardState) {
      setBoard(boardState.map((row) => [...row]));
    }

    setCurrentStep(newStep);
    setHighlightedCell({ row, col, actionType });
  };

  /**
   * updates board and currentstep on 1 second interval
   * after change of currentstep, solversteps, or solverstatus
   * */
  useEffect(() => {
    let timer;

    if (
      solverStatus === "running" &&
      currentStep === null &&
      solverSteps.length > 0
    ) {
      setCurrentStep(0);
      updateBoardAndStep(0);
    } else if (solverStatus === "running" || solverStatus === "resumed") {
      timer = setInterval(() => {
        if (
          solverSteps.length > 0 &&
          currentStep !== null &&
          (solverStatus === "running" || solverStatus === "resumed")
        ) {
          if (currentStep < solverSteps.length - 1) {
            updateBoardAndStep(currentStep + 1);
          } else {
            clearInterval(timer);
            setSolverStatus("stopped");
          }
        }
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [currentStep, solverSteps, solverStatus]);

  /**solves puzzle or sets solver status to paused based on user action */
  const controlSolver = async (action) => {
    if (action === "start") {
      await fetchAndSetSolverSteps(selectedPuzzle);

      setSolverStatus("running");
    } else if (action === "pause") {
      setSolverStatus("paused");
    } else if (action === "resume") {
      setSolverStatus("resumed");
    }
  };

  /**sets step index on user click */
  const handleStepChange = (direction) => {
    if (direction === "forward" && currentStep < solverSteps.length - 1) {
      setSolverStatus("paused");
      updateBoardAndStep(currentStep + 1);
    } else if (direction === "backward" && currentStep > 0) {
      setSolverStatus("paused");
      updateBoardAndStep(currentStep - 1);
    }
  };

  /**fetches puzzle name on mount */
  useEffect(() => {
    const fetchPuzzles = async () => {
      try {
        const resp = await SudokuApi.getPuzzles("/puzzles");
        setPuzzles(resp.puzzles);

        //automatically load first puzzle up
        if (resp.puzzles && Object.keys(resp.puzzles).length > 0) {
          const firstDifficulty = Object.keys(resp.puzzles)[0];
          const firstPuzzle = resp.puzzles[firstDifficulty][0];
          loadPuzzle(firstDifficulty, firstPuzzle);
        }
      } catch (err) {
        console.error("failed to feth puzzles", err);
      }
    };
    fetchPuzzles();
  }, []);

  /**fetches puzzle data on user click and clears any existing highlights */
  const handleSelectPuzzle = (difficulty, puzzleId) => {
    loadPuzzle(difficulty, puzzleId);
    setHighlightedCell(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sudoku Solver</h1>
        <p>{paragraph}</p>
        <p>
          Witness the magic as the algorithm intelligently solves a sudoku
          puzzle of your choice!
        </p>
      </header>
      <ControlPanel
        className="control-panel"
        onStart={() => controlSolver("start")}
        onPause={() => controlSolver("pause")}
        onResume={() => controlSolver("resume")}
        onStepForward={() => handleStepChange("forward")}
        onStepBackward={() => handleStepChange("backward")}
      />
      <div className="board-and-animation-container">
        <SudokuBoard board={board} highlightedCell={highlightedCell} />

        <SolverStepsAnimation
          currentStep={currentStep}
          solverSteps={solverSteps}
        />
      </div>
      <DifficultySelector
        className="difficulty-selector"
        onSelectPuzzle={handleSelectPuzzle}
        puzzles={puzzles}
      />
    </div>
  );
}

export default App;
