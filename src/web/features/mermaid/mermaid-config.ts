import type { MermaidConfig } from 'mermaid';

/**
 * Mermaid kan ikke lese CSS-variabler, så vi leser ferdige hex-tokens fra getComputedStyle
 * ved hvert tema-bytte (designsystem §6).
 */
export function mermaidConfig(root: HTMLElement = document.documentElement): MermaidConfig {
  const cs = getComputedStyle(root);
  const t = (name: string) => cs.getPropertyValue(name).trim();
  const dark = root.dataset.mode === 'dark';
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: t('--font-ui'),
    themeVariables: {
      darkMode: dark,
      fontFamily: t('--font-ui'),
      fontSize: '14px',
      background: t('--color-surface'),
      textColor: t('--color-text'),
      lineColor: t('--color-muted'),
      primaryColor: t('--color-bg'),
      primaryTextColor: t('--color-text'),
      primaryBorderColor: t('--color-rule-strong'),
      secondaryColor: t('--color-sunken'),
      secondaryTextColor: t('--color-text'),
      secondaryBorderColor: t('--color-rule-strong'),
      tertiaryColor: t('--color-surface'),
      tertiaryTextColor: t('--color-text'),
      tertiaryBorderColor: t('--color-rule'),
      mainBkg: t('--color-bg'),
      nodeBorder: t('--color-rule-strong'),
      nodeTextColor: t('--color-text'),
      clusterBkg: t('--color-sunken'),
      clusterBorder: t('--color-rule'),
      titleColor: t('--color-text'),
      edgeLabelBackground: t('--color-surface'),
      actorBkg: t('--color-bg'),
      actorBorder: t('--color-rule-strong'),
      actorTextColor: t('--color-text'),
      actorLineColor: t('--color-rule-strong'),
      signalColor: t('--color-muted'),
      signalTextColor: t('--color-text'),
      labelBoxBkgColor: t('--color-surface'),
      labelBoxBorderColor: t('--color-rule-strong'),
      labelTextColor: t('--color-text'),
      loopTextColor: t('--color-muted'),
      activationBkgColor: t('--color-sunken'),
      activationBorderColor: t('--color-accent'),
      noteBkgColor: t('--color-mark'),
      noteTextColor: t('--color-text'),
      noteBorderColor: t('--color-rule-strong'),
      sequenceNumberColor: t('--color-bg'),
      errorBkgColor: t('--color-bg'),
      errorTextColor: t('--hue-red'),
      taskBkgColor: t('--color-sunken'),
      taskBorderColor: t('--color-accent'),
      taskTextColor: t('--color-text'),
      activeTaskBkgColor: t('--color-mark'),
      doneTaskBkgColor: t('--color-surface'),
      critBorderColor: t('--hue-red'),
      todayLineColor: t('--color-accent'),
      gridColor: t('--color-rule'),
      pie1: t('--hue-blue'),
      pie2: t('--hue-orange'),
      pie3: t('--hue-green'),
      pie4: t('--hue-plum'),
      pie5: t('--hue-teal'),
      pie6: t('--hue-amber'),
      pie7: t('--hue-red'),
      pie8: t('--hue-grey'),
      pieStrokeColor: t('--color-bg'),
      pieTitleTextColor: t('--color-text'),
      pieSectionTextColor: t('--color-bg'),
      git0: t('--color-accent'),
      git1: t('--hue-blue'),
      git2: t('--hue-green'),
      git3: t('--hue-orange'),
    },
  };
}

/** Bildetekst fra `%% caption: …`-kommentar i kilden (designsystem §6). */
export function mermaidCaption(source: string): string | null {
  const match = /^\s*%%\s*caption\s*:\s*(.+?)\s*$/im.exec(source);
  return match?.[1] ?? null;
}
