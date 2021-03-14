import ogs from 'open-graph-scraper'

export function buildOGPDOMString(originalUrl: string, ogsResult: ogs.SuccessResult['result']): string {
  const hostname = ogsResult.ogUrl ? new URL(ogsResult.ogUrl).hostname : ''

  return `\
    <a href="${originalUrl}" class="flex block border-2 rounded flex-col sm:flex-row bg-white" style="max-width: 36rem; min-height: 8rem">
      ${ogsResult.ogImage && ogsResult.ogImage.url? `
      <div class="flex flex-row sm:flex-col justify-center">
        <div class="w-32">
          <img class="object-fill max-h-32" src="${ogsResult.ogImage.url}" alt="${ogsResult.ogImage.url}" />
        </div>
      </div>
      ` : ''}
      <div class="mx-2 my-4 flex flex-col justify-between">
        <div>
          <div class="text-gray-800">${ogsResult.ogTitle ?? ''}</div>
          <div class="text-gray-400">${ogsResult.ogDescription ?? ''}</div>
        </div>
        <div class="text-sm mt-2 text-gray-400 text-right">${hostname}</div>
      </div>
    </a>
  `
}