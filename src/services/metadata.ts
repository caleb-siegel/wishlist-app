export interface LinkMetadata {
  title: string | null;
  imageUrl: string | null;
  approxPrice: number | null;
  currency: string;
}

/**
 * Validates that a string is a valid http or https URL.
 */
export function isValidWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts OpenGraph and HTML metadata from a raw HTML string.
 */
function parseHtmlMetadata(html: string, pageUrl: string): LinkMetadata {
  const result: LinkMetadata = {
    title: null,
    imageUrl: null,
    approxPrice: null,
    currency: 'USD',
  };

  try {
    // 1. Extract Title
    // Try og:title first
    const ogTitleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      result.title = decodeHtmlEntities(ogTitleMatch[1].trim());
    } else {
      // Fallback to <title>...</title>
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleTagMatch && titleTagMatch[1]) {
        result.title = decodeHtmlEntities(titleTagMatch[1].trim());
      }
    }

    // 2. Extract Image
    // Try og:image or twitter:image
    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      let rawImageUrl = ogImageMatch[1].trim();
      // Handle relative URLs
      if (rawImageUrl.startsWith('//')) {
        rawImageUrl = 'https:' + rawImageUrl;
      } else if (rawImageUrl.startsWith('/')) {
        try {
          const origin = new URL(pageUrl).origin;
          rawImageUrl = origin + rawImageUrl;
        } catch {
          // ignore
        }
      }
      result.imageUrl = rawImageUrl;
    }

    // 3. Extract Price
    // Check og:price:amount or product:price:amount
    const ogPriceMatch =
      html.match(/<meta[^>]*property=["'](?:og|product):price:amount["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og|product):price:amount["']/i);

    if (ogPriceMatch && ogPriceMatch[1]) {
      const parsedNum = parseFloat(ogPriceMatch[1].replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedNum)) {
        result.approxPrice = parsedNum;
      }
    } else {
      // Check JSON-LD for "price": 49.99 or "price": "49.99"
      const jsonLdMatch = html.match(/"price"\s*:\s*["']?([0-9]+(?:\.[0-9]{2})?)["']?/i);
      if (jsonLdMatch && jsonLdMatch[1]) {
        const parsedNum = parseFloat(jsonLdMatch[1]);
        if (!isNaN(parsedNum)) {
          result.approxPrice = parsedNum;
        }
      }
    }

    // 4. Extract Currency
    const currencyMatch =
      html.match(/<meta[^>]*property=["'](?:og|product):price:currency["'][^>]*content=["']([^"']+)["']/i);
    if (currencyMatch && currencyMatch[1]) {
      result.currency = currencyMatch[1].trim().toUpperCase();
    }
  } catch (err) {
    console.warn('HTML metadata parsing error:', err);
  }

  return result;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

/**
 * Attempts best-effort metadata extraction with a strict timeout.
 * Never throws an error; returns partial or empty fields so the user can edit manually.
 */
export async function fetchLinkMetadata(rawUrl: string): Promise<LinkMetadata> {
  const emptyResult: LinkMetadata = {
    title: null,
    imageUrl: null,
    approxPrice: null,
    currency: 'USD',
  };

  const cleanUrl = rawUrl.trim();
  if (!isValidWebUrl(cleanUrl)) {
    return emptyResult;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s max timeout

  try {
    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return emptyResult;
    }

    const html = await response.text();
    return parseHtmlMetadata(html, cleanUrl);
  } catch (e) {
    clearTimeout(timeoutId);
    // Best-effort: return empty metadata so user can type manually
    return emptyResult;
  }
}
