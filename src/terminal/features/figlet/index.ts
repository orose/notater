/** figlet: egne FIGlet-fonter, leser og fallback-kjeden for hodet (ADR-011 §5, designsystem-terminal §3). */
export { chooseHeader, drawnHeight, headerHeight, loadFont, type FontName, type Header, type HeaderLimits } from './header';
export { figletText, figletWidth, parseFlf, renderFiglet, type FlfFont } from './flf';
