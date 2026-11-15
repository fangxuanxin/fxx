// Pagefind 搜索包装（PagefindUI 通过 bundlePath 加载本文件，用法与原模块完全一致）。
// 规则：
//   1. 空格分隔的多个词按 AND 处理：每个词都必须出现在文章里；
//   2. 每个词按整词精确匹配、不区分大小写：
//      中文不再拆成单字（否则搜「人们」只要有「人」就算命中），英文按完整单词（否则搜「ai」会命中「Air」）；
//   3. 用户自己加了引号的短语原样保留。
import * as pagefind from '/pagefind/pagefind.js';

export const { options, init, filters, destroy, mergeIndex, createInstance, debouncedSearch } = pagefind;

/** 把搜索框内容拆成词：引号内的短语算一个词，其余按空白分开 */
function splitTerms(term) {
  return (term.match(/"[^"]*"|\S+/g) ?? []).filter((part) => part.replace(/"/g, '').trim());
}

/** 没有引号的词加上引号，让 Pagefind 按整词精确匹配 */
function exact(term) {
  return term.includes('"') ? term : `"${term}"`;
}

export async function preload(term, opts) {
  await Promise.all(splitTerms(term).map((part) => pagefind.preload(exact(part), opts)));
}

export async function search(term, opts) {
  const terms = splitTerms(term);
  if (terms.length <= 1) return pagefind.search(exact(terms[0] ?? term), opts);
  const responses = await Promise.all(terms.map((part) => pagefind.search(exact(part), opts)));
  if (responses.some((response) => !response)) return null;
  // 以第一个词的结果为准（保留它的排序和摘要），只留下其余每个词也命中的文章
  const others = responses.slice(1).map((response) => new Set(response.results.map((result) => result.id)));
  const [first] = responses;
  return { ...first, results: first.results.filter((result) => others.every((ids) => ids.has(result.id))) };
}
