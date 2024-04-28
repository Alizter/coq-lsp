import {
  window,
  workspace,
  TextEditorDecorationType,
  Range,
  Selection,
  Disposable,
  TextEditor,
  TextDocument,
  languages
} from "vscode";
import { CoqSelector } from "./config";

export class HeatMap {
    private subscriptions: Disposable[] = [];
    enabled: boolean = false;
    heatStyles: TextEditorDecorationType[] = [];
    
    dispose() {
        if (this.subscriptions) {
            this.subscriptions.forEach(subscription => subscription.dispose());
        }
        this.heatStyles.forEach(style => style.dispose());
    }

    constructor(enabled: boolean) {
        this.enabled = enabled;
        this.activate();
        this.registerEventListeners();
    }
    
    private registerEventListeners() {
        // Redraw when the active text editor changes
        this.subscriptions.push(window.onDidChangeActiveTextEditor(editor => {
            this.draw(editor);
        }));

        // Redraw when the document is edited
        this.subscriptions.push(window.onDidChangeTextEditorSelection(event => {
            this.draw(event.textEditor);
        }));
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.draw(window.activeTextEditor);
        } else {
            this.clearHeatMap();
        }
    }

    draw(editor?: TextEditor) {
        if (!editor) {
            return;
        }
    
        if (languages.match(CoqSelector.local, editor.document) === 0) {
            return;
        }

        const document = editor.document;
        const dataPoints = getRandomDataForLines(document);
        const minData = Math.min(...dataPoints);
        const maxData = Math.max(...dataPoints);
        const dataRange = maxData - minData;

        if (dataRange === 0) {
            return;
        }

        const dataPerLevel = dataRange / this.heatStyles.length;
        const ranges: Range[][] = new Array(this.heatStyles.length).fill(null).map(() => []);

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const range = new Selection(line.range.start, line.range.end);
            const dataPoint = dataPoints[i];
            const bucket = Math.min(this.heatStyles.length - 1, Math.floor((dataPoint - minData) / dataPerLevel));
            ranges[bucket].push(range);
        }

        this.heatStyles.forEach((style, i) => editor.setDecorations(style, ranges[i]));
    }

    clearHeatMap() {
        const editor = window.activeTextEditor;
        if (editor) {
            this.heatStyles.forEach(style => editor.setDecorations(style, []));
        }
    }

    activate() {
        const heatLevels = workspace.getConfiguration('heatmap').get<number>('heatLevels') || 100;
        const heatColour = workspace.getConfiguration('heatmap').get<string>('heatColour') || '200,0,0';

        this.heatStyles.forEach(style => style.dispose()); // Dispose the old styles if they exist.
        this.heatStyles = []; // Reset the array

        for (let i = 0; i < heatLevels; i++) {
            let alphaValue = 1 - i / (heatLevels - 1);
            this.heatStyles.push(window.createTextEditorDecorationType({
                backgroundColor: `rgba(${heatColour}, ${alphaValue})`
            }));
        }
    }
}

function getRandomDataForLines(document: TextDocument): number[] {
    let data: number[] = new Array(document.lineCount);
    for (let i = 0; i < document.lineCount; i++) {
        data[i] = Math.random() * 1000;
    }
    return data;
}
