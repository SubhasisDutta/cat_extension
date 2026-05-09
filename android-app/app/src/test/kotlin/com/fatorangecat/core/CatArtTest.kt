package com.fatorangecat.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CatArtTest {

    @Test
    fun phraseForSecond_isDeterministicAndBounded() {
        for (s in 0 until 600) {
            val p = CatArt.phraseForSecond(s)
            assertTrue(p.isNotEmpty())
        }
        assertEquals(CatArt.phraseForSecond(0), CatArt.phraseForSecond(CatArt.PHRASES.size))
    }

    @Test
    fun phraseForSecond_handlesNegativeSeconds() {
        assertEquals(CatArt.phraseForSecond(3), CatArt.phraseForSecond(-3))
    }

    @Test
    fun svgMarkup_containsAnSvgRootAndTheOrangePalette() {
        val svg = CatArt.svgMarkup()
        assertTrue(svg.contains("<svg"))
        assertTrue(svg.contains("</svg>"))
        // Orange-y stops we depend on for the "fat orange cat" vibe.
        assertTrue(svg.contains("#ef8b2a"))
    }

    @Test
    fun phrases_stayOnBrand_noApologiesNoPlease() {
        for (p in CatArt.PHRASES) {
            val lower = p.lowercase()
            assertFalse("apology in: $p", lower.contains("sorry"))
            assertFalse("politeness in: $p", lower.contains("please"))
        }
    }
}
