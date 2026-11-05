---
tags: [qa, kode, ytelse]
---
# Stor kodeblokk

Én Java-kodeblokk på **596 linjer**. Forventet: highlighting uten merkbar frysing (notatbytte < 200 ms, AK17), kopier-knappen kopierer *hele* blokken, siden scroller jevnt.

```java
package no.eksempel.lager;

import java.util.*;
import java.time.*;

/**
 * Generert, men realistisk Java-klasse for å teste rendering av svært lange kodeblokker.
 */
public final class Lagerberegning {

    /** Beregner tilgjengelig beholdning for kaffekopp (#0). */
    public static int tilgjengeligKaffekopp0(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kaffekopp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for tekanne (#1). */
    public static int tilgjengeligTekanne1(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Tekanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for skjærefjøl (#2). */
    public static int tilgjengeligSkjærefjøl2(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Skjærefjøl: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for brødkniv (#3). */
    public static int tilgjengeligBrødkniv3(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødkniv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for stekepanne (#4). */
    public static int tilgjengeligStekepanne4(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekepanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for kasserolle (#5). */
    public static int tilgjengeligKasserolle5(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kasserolle: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for vannkoker (#6). */
    public static int tilgjengeligVannkoker6(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Vannkoker: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for brødrister (#7). */
    public static int tilgjengeligBrødrister7(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødrister: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for mikser (#8). */
    public static int tilgjengeligMikser8(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Mikser: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for visp (#9). */
    public static int tilgjengeligVisp9(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Visp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for sleiv (#10). */
    public static int tilgjengeligSleiv10(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Sleiv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for øse (#11). */
    public static int tilgjengeligØse11(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Øse: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for rivjern (#12). */
    public static int tilgjengeligRivjern12(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Rivjern: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for målebeger (#13). */
    public static int tilgjengeligMålebeger13(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Målebeger: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for stekespade (#14). */
    public static int tilgjengeligStekespade14(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekespade: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for kaffekopp (#15). */
    public static int tilgjengeligKaffekopp15(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kaffekopp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for tekanne (#16). */
    public static int tilgjengeligTekanne16(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Tekanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for skjærefjøl (#17). */
    public static int tilgjengeligSkjærefjøl17(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Skjærefjøl: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for brødkniv (#18). */
    public static int tilgjengeligBrødkniv18(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødkniv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for stekepanne (#19). */
    public static int tilgjengeligStekepanne19(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekepanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for kasserolle (#20). */
    public static int tilgjengeligKasserolle20(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kasserolle: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for vannkoker (#21). */
    public static int tilgjengeligVannkoker21(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Vannkoker: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for brødrister (#22). */
    public static int tilgjengeligBrødrister22(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødrister: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for mikser (#23). */
    public static int tilgjengeligMikser23(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Mikser: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for visp (#24). */
    public static int tilgjengeligVisp24(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Visp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for sleiv (#25). */
    public static int tilgjengeligSleiv25(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Sleiv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for øse (#26). */
    public static int tilgjengeligØse26(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Øse: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for rivjern (#27). */
    public static int tilgjengeligRivjern27(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Rivjern: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for målebeger (#28). */
    public static int tilgjengeligMålebeger28(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Målebeger: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for stekespade (#29). */
    public static int tilgjengeligStekespade29(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekespade: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for kaffekopp (#30). */
    public static int tilgjengeligKaffekopp30(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kaffekopp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for tekanne (#31). */
    public static int tilgjengeligTekanne31(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Tekanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for skjærefjøl (#32). */
    public static int tilgjengeligSkjærefjøl32(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Skjærefjøl: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for brødkniv (#33). */
    public static int tilgjengeligBrødkniv33(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødkniv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for stekepanne (#34). */
    public static int tilgjengeligStekepanne34(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekepanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for kasserolle (#35). */
    public static int tilgjengeligKasserolle35(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kasserolle: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for vannkoker (#36). */
    public static int tilgjengeligVannkoker36(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Vannkoker: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for brødrister (#37). */
    public static int tilgjengeligBrødrister37(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødrister: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for mikser (#38). */
    public static int tilgjengeligMikser38(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Mikser: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for visp (#39). */
    public static int tilgjengeligVisp39(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Visp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for sleiv (#40). */
    public static int tilgjengeligSleiv40(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Sleiv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for øse (#41). */
    public static int tilgjengeligØse41(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Øse: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for rivjern (#42). */
    public static int tilgjengeligRivjern42(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Rivjern: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for målebeger (#43). */
    public static int tilgjengeligMålebeger43(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Målebeger: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for stekespade (#44). */
    public static int tilgjengeligStekespade44(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekespade: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for kaffekopp (#45). */
    public static int tilgjengeligKaffekopp45(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kaffekopp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for tekanne (#46). */
    public static int tilgjengeligTekanne46(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Tekanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for skjærefjøl (#47). */
    public static int tilgjengeligSkjærefjøl47(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Skjærefjøl: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for brødkniv (#48). */
    public static int tilgjengeligBrødkniv48(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødkniv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for stekepanne (#49). */
    public static int tilgjengeligStekepanne49(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekepanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for kasserolle (#50). */
    public static int tilgjengeligKasserolle50(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kasserolle: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for vannkoker (#51). */
    public static int tilgjengeligVannkoker51(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Vannkoker: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for brødrister (#52). */
    public static int tilgjengeligBrødrister52(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødrister: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for mikser (#53). */
    public static int tilgjengeligMikser53(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Mikser: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for visp (#54). */
    public static int tilgjengeligVisp54(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Visp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for sleiv (#55). */
    public static int tilgjengeligSleiv55(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Sleiv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for øse (#56). */
    public static int tilgjengeligØse56(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Øse: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for rivjern (#57). */
    public static int tilgjengeligRivjern57(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Rivjern: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

    /** Beregner tilgjengelig beholdning for målebeger (#58). */
    public static int tilgjengeligMålebeger58(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Målebeger: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 12);
    }

    /** Beregner tilgjengelig beholdning for stekespade (#59). */
    public static int tilgjengeligStekespade59(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekespade: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 13);
    }

    /** Beregner tilgjengelig beholdning for kaffekopp (#60). */
    public static int tilgjengeligKaffekopp60(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Kaffekopp: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 14);
    }

    /** Beregner tilgjengelig beholdning for tekanne (#61). */
    public static int tilgjengeligTekanne61(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Tekanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 15);
    }

    /** Beregner tilgjengelig beholdning for skjærefjøl (#62). */
    public static int tilgjengeligSkjærefjøl62(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Skjærefjøl: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 16);
    }

    /** Beregner tilgjengelig beholdning for brødkniv (#63). */
    public static int tilgjengeligBrødkniv63(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Brødkniv: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 10);
    }

    /** Beregner tilgjengelig beholdning for stekepanne (#64). */
    public static int tilgjengeligStekepanne64(int beholdning, int reservert, int iBestilling) {
        if (beholdning < 0 || reservert < 0) {
            throw new IllegalArgumentException("Negativ beholdning for Stekepanne: " + beholdning);
        }
        int ledig = Math.max(0, beholdning - reservert);
        return ledig + Math.min(iBestilling, 11);
    }

}
```

Slutt på notatet. Hvis du ser denne linjen, ble hele blokken rendret.
