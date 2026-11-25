const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );

export function labelSheet(orderNumber, labels) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Garment labels</title>
    <style>@page { margin: 12mm; } body { font-family: sans-serif; color: #12392f; }
    .label { display: inline-block; vertical-align: top; box-sizing: border-box; width: 48%; padding: 12px; margin: 0 1% 12px; border: 1px solid #777; text-align: center; break-inside: avoid; }
    img { width: 150px; height: 150px; } p { margin: 6px 0; overflow-wrap: anywhere; } .code { font-size: 9px; }</style>
    </head><body>${labels
      .map((label) => {
        if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(label.image))
          throw new Error('The outlet returned an invalid label image.');
        return `<div class="label"><strong>LaundryTrack · ${escapeHtml(orderNumber)}</strong>
      <p>${escapeHtml(label.color)} ${escapeHtml(label.type)}</p><img src="${label.image}" />
      <p class="code">${escapeHtml(label.payload)}</p></div>`;
      })
      .join('')}</body></html>`;
}
