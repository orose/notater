import { describe, expect, it } from 'vitest';
import { checkExpression, evaluate } from './evaluate';
import { parseExpression } from './parser';
import { fakeContext, fakeSubject } from './test-subject';
import type { FakeFile } from './test-subject';
import { dateValue, list } from './values';
import type { Value } from './values';

const task: FakeFile = {
  path: 'oppgaver/Migrer til Java 21.md',
  tags: ['task/backend', 'Team'],
  props: { status: 'doing', priority: 1, due: dateValue(Date.UTC(2026, 10, 8), false), 'mitt felt': 'x', liste: list(['a', 'b']) },
  links: ['domene/Kunde'],
};

function run(src: string, file: FakeFile = task, formulas: Record<string, Value> = {}): Value {
  const parsed = parseExpression(src);
  if (!parsed.ok) throw new Error(parsed.error);
  return evaluate(parsed.expr, fakeContext(fakeSubject(file), formulas));
}

describe('evaluate – file.*', () => {
  it('felter', () => {
    expect(run('file.name')).toBe('Migrer til Java 21');
    expect(run('file.basename')).toBe('Migrer til Java 21');
    expect(run('file.ext')).toBe('md');
    expect(run('file.folder')).toBe('oppgaver');
    expect(run('file.folder', { path: 'Velkommen.md' })).toBe('/');
    expect(run('file.path')).toBe('oppgaver/Migrer til Java 21.md');
    expect(run('file.size')).toBe(100);
    expect(run('file.mtime')).toEqual(dateValue(Date.UTC(2026, 10, 1, 12), true));
    expect(run('file.ctime')).toEqual(dateValue(Date.UTC(2026, 0, 1), true));
    expect(run('file.tags')).toEqual(list(['task/backend', 'Team']));
  });

  it('inFolder er rekursiv, men ikke prefiks (O5/B1)', () => {
    expect(run('file.inFolder("oppgaver")')).toBe(true);
    expect(run('file.inFolder("oppgaver/")')).toBe(true);
    expect(run('file.inFolder("domene")', { path: 'domene/delt/Adresse.md' })).toBe(true);
    expect(run('file.inFolder("domene")', { path: 'domene-arkiv/Gammel kunde.md' })).toBe(false);
    expect(run('file.inFolder("opp")')).toBe(false);
  });

  it('hasTag: nestet, case-insensitiv, flere argumenter, med/uten #', () => {
    expect(run('file.hasTag("task")')).toBe(true);
    expect(run('file.hasTag("TEAM")')).toBe(true);
    expect(run('file.hasTag("#team")')).toBe(true);
    expect(run('file.hasTag("tas")')).toBe(false);
    expect(run('file.hasTag("task/backend/x")')).toBe(false);
    expect(run('file.hasTag("x", "team")')).toBe(true);
    expect(run('file.hasTag("task")', { path: 'x.md', tags: ['taskforce', 'tasks'] })).toBe(false);
  });

  it('hasLink og hasProperty', () => {
    expect(run('file.hasLink("domene/Kunde")')).toBe(true);
    expect(run('file.hasLink(link("domene/Kunde"))')).toBe(true);
    expect(run('file.hasLink("Finnes ikke")')).toBe(false);
    expect(run('file.hasProperty("Status")')).toBe(true);
    expect(run('file.hasProperty("mangler")')).toBe(false);
  });
});

describe('evaluate – properties og navnerom', () => {
  it('bar identifikator = note.x; note["…"] for navn med mellomrom', () => {
    expect(run('status')).toBe('doing');
    expect(run('note.status')).toBe('doing');
    expect(run('note["mitt felt"]')).toBe('x');
    expect(run('mangler')).toBeNull();
    expect(run('file.properties.status')).toBe('doing');
  });

  it('formula.x og formula["x"]', () => {
    expect(run('formula.team', task, { team: 'Testgjengen' })).toBe('Testgjengen');
    expect(run('formula["team"] + "!"', task, { team: 'T' })).toBe('T!');
  });
});

describe('evaluate – operatorer (O6)', () => {
  it('likhet er typestreng og case-sensitiv', () => {
    expect(run('status == "doing"')).toBe(true);
    expect(run('status == "Doing"')).toBe(false);
    expect(run('priority == 1')).toBe(true);
    expect(run('priority == "1"')).toBe(false);
    expect(run('mangler == null')).toBe(true);
  });

  it('manglende property: != er sann, == er usann (B4)', () => {
    expect(run('mangler != "done"')).toBe(true);
    expect(run('mangler == "done"')).toBe(false);
  });

  it('sammenligning: tall, strenger, datoer mot datostreng; ulike typer er usant', () => {
    expect(run('priority < 2')).toBe(true);
    expect(run('priority >= 1 && priority <= 1')).toBe(true);
    expect(run('due < "2026-11-09"')).toBe(true);
    expect(run('due == "2026-11-08"')).toBe(true);
    expect(run('due > date("2026-12-01")')).toBe(false);
    expect(run('"b" > "a"')).toBe(true);
    expect(run('priority < "2"')).toBe(false);
    expect(run('mangler < 5')).toBe(false);
    expect(run('mangler > 5')).toBe(false);
  });

  it('!, &&, || med kortslutning og JS-verdisemantikk', () => {
    expect(run('!file.hasTag("team")')).toBe(false);
    expect(run('!mangler')).toBe(true);
    expect(run('mangler || "ingen"')).toBe('ingen');
    expect(run('status && priority')).toBe(1);
    expect(run('false && finnesIkke()')).toBe(false);
  });

  it('aritmetikk og konkatenering', () => {
    expect(run('priority + 2 * 3')).toBe(7);
    expect(run('(priority + 2) * 3')).toBe(9);
    expect(run('10 / 4')).toBe(2.5);
    expect(run('10 % 4')).toBe(2);
    expect(run('-priority')).toBe(-1);
    expect(run('1 / 0')).toBeNull();
    expect(run('"P" + priority')).toBe('P1');
    expect(run('status + "-" + file.name')).toBe('doing-Migrer til Java 21');
    expect(run('"x" * 2')).toBeNull();
  });

  it('dato ± varighet og dato − dato', () => {
    expect(run('due + "1d"')).toEqual(dateValue(Date.UTC(2026, 10, 9), false));
    expect(run('due - "1 week"')).toEqual(dateValue(Date.UTC(2026, 10, 1), false));
    expect(run('due + "1M"')).toEqual(dateValue(Date.UTC(2026, 11, 8), false));
    expect(run('(due + "2d") - due')).toBe(2 * 86_400_000);
  });
});

describe('evaluate – funksjoner og metoder', () => {
  it('if(): lat, valgfri else-gren', () => {
    expect(run('if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")')).toBe('Testgjengen');
    expect(run('if(file.hasTag("nei"), "a", "b")')).toBe('b');
    expect(run('if(false, "a")')).toBeNull();
  });

  it('now(), today(), date(), number(), list(), link(), min/max', () => {
    expect(run('now()')).toEqual(dateValue(Date.UTC(2026, 10, 5, 13, 30), true));
    expect(run('today()')).toMatchObject({ kind: 'date', hasTime: false });
    expect(run('date("2026-01-02")')).toEqual(dateValue(Date.UTC(2026, 0, 2), false));
    expect(run('date("tull")')).toBeNull();
    expect(run('number("42")')).toBe(42);
    expect(run('number("x")')).toBeNull();
    expect(run('number(true)')).toBe(1);
    expect(run('list(status)')).toEqual(list(['doing']));
    expect(run('list(liste)')).toEqual(list(['a', 'b']));
    expect(run('link("domene/Kunde", "K")')).toMatchObject({ kind: 'link', filePath: 'domene/Kunde.md', display: 'K' });
    expect(run('max(3, priority, 7)')).toBe(7);
    expect(run('min([3, 2], 5)')).toBe(2);
  });

  it('strengmetoder', () => {
    expect(run('status.contains("oi")')).toBe(true);
    expect(run('status.startsWith("do")')).toBe(true);
    expect(run('status.endsWith("ng")')).toBe(true);
    expect(run('status.upper()')).toBe('DOING');
    expect(run('"ABC".lower()')).toBe('abc');
    expect(run('status.length')).toBe(5);
    expect(run('"a,b".split(",")')).toEqual(list(['a', 'b']));
    expect(run('"aXa".replace("a", "b")')).toBe('bXb');
    expect(run('"  x ".trim()')).toBe('x');
    expect(run('"".isEmpty()')).toBe(true);
    expect(run('status.title()')).toBe('Doing');
  });

  it('listemetoder', () => {
    expect(run('file.tags.contains("Team")')).toBe(true);
    expect(run('liste.containsAll("a", "b")')).toBe(true);
    expect(run('liste.containsAny("x", "b")')).toBe(true);
    expect(run('liste.join(" / ")')).toBe('a / b');
    expect(run('liste.length')).toBe(2);
    expect(run('liste[0]')).toBe('a');
    expect(run('liste[-1]')).toBe('b');
    expect(run('liste.reverse()')).toEqual(list(['b', 'a']));
    expect(run('[2, 10, 1].sort()')).toEqual(list([1, 2, 10]));
    expect(run('[1, 1, 2].unique()')).toEqual(list([1, 2]));
    expect(run('[].isEmpty()')).toBe(true);
  });

  it('tall- og datometoder', () => {
    expect(run('(10 / 3).round(2)')).toBe(3.33);
    expect(run('(2.5).floor()')).toBe(2);
    expect(run('(2.1).ceil()')).toBe(3);
    expect(run('(-2).abs()')).toBe(2);
    expect(run('(1.5).toFixed(2)')).toBe('1.50');
    expect(run('due.format("DD.MM.YYYY")')).toBe('08.11.2026');
    expect(run('due.year')).toBe(2026);
    expect(run('due.month')).toBe(11);
    expect(run('due.day')).toBe(8);
  });

  it('ukjent funksjon/metode/felt gir null, ikke unntak', () => {
    expect(run('finnesIkke(1)')).toBeNull();
    expect(run('file.finnesIkke("x")')).toBeNull();
    expect(run('status.finnesIkke()')).toBeNull();
    expect(run('priority.upper()')).toBeNull();
    expect(run('file.navn')).toBeNull();
    expect(run('mangler.x.y')).toBeNull();
    expect(run('this')).toBeNull();
  });
});

describe('checkExpression', () => {
  const check = (src: string) => {
    const parsed = parseExpression(src);
    if (!parsed.ok) throw new Error(parsed.error);
    return checkExpression(parsed.expr);
  };

  it('finner ukjente funksjoner og metoder', () => {
    expect(check('file.finnesIkke("x")').unknownFunctions).toEqual(['file.finnesIkke']);
    expect(check('tull(1) && file.hasTag("x")').unknownFunctions).toEqual(['tull']);
    expect(check('if(file.hasTag("team"), "a", "b")').unknownFunctions).toEqual([]);
  });

  it('finner ukjente file-felter, formelreferanser og klokkebruk', () => {
    expect(check('file.navn == "x"').unknownFields).toEqual(['file.navn']);
    expect(check('file.inFolder("x")').unknownFields).toEqual([]);
    expect(check('formula.a + formula["b"]').formulaRefs).toEqual(['a', 'b']);
    expect(check('due < today()').usesClock).toBe(true);
    expect(check('due < date("2026-01-01")').usesClock).toBe(false);
  });
});
