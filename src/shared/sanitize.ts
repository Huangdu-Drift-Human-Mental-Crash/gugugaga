export interface MaskResult {
  text: string;
  masked: boolean;
  replacements: Array<{ token: string; value: string }>;
}

const sensitivePatterns: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\d[ -]*?){13,19}\b/g,
  /\b(?:sk|pk|rk|ak|api|key|token)[_-]?[a-z0-9]{16,}\b/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
];

export function maskSensitiveText(text: string): MaskResult {
  let output = text;
  const replacements: Array<{ token: string; value: string }> = [];
  for (const pattern of sensitivePatterns) {
    output = output.replace(pattern, (value) => {
      const token = `[BR_MASK_${replacements.length + 1}]`;
      replacements.push({ token, value });
      return token;
    });
  }
  return {
    text: output,
    masked: replacements.length > 0,
    replacements,
  };
}

