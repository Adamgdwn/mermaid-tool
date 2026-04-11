import { Canvg } from "canvg";

function parseDimension(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }

  const numericValue = Number.parseFloat(rawValue);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }

  return null;
}

function getSvgDimensions(svgMarkup: string): { height: number; width: number } {
  const document = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const svgElement = document.documentElement;

  const widthFromAttribute = parseDimension(svgElement.getAttribute("width"));
  const heightFromAttribute = parseDimension(svgElement.getAttribute("height"));
  if (widthFromAttribute && heightFromAttribute) {
    return {
      height: heightFromAttribute,
      width: widthFromAttribute
    };
  }

  const viewBox = svgElement.getAttribute("viewBox");
  if (viewBox) {
    const [, , width, height] = viewBox.split(/\s+/).map((value) => Number.parseFloat(value));
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { height, width };
    }
  }

  return { height: 900, width: 1400 };
}

export async function renderSvgToPngDataUrl(svgMarkup: string): Promise<string> {
  const { height, width } = getSvgDimensions(svgMarkup);
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The browser canvas context was unavailable.");
  }

  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const renderer = Canvg.fromString(context, svgMarkup, {
    ignoreAnimation: true,
    ignoreClear: true,
    ignoreDimensions: true
  });

  await renderer.render();
  return canvas.toDataURL("image/png");
}
