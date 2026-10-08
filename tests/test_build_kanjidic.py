import importlib.util
import pathlib
import unittest
p = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "build_kanjidic.py"
spec = importlib.util.spec_from_file_location("build_kanjidic",p)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ConversionTests(unittest.TestCase):
    def test_readings_and_self_variants(self):
        src={"characters":[{"literal":"学","codepoints":[{"type":"jis208","value":"1"}],
          "readingMeaning":{"groups":[{"readings":[{"type":"ja_on","value":"ガク"},{"type":"ja_kun","value":"まな.ぶ"}],
          "meanings":[{"lang":"en","value":"study"}]}]},
          "misc":{"strokeCounts":[8],"variants":[{"type":"jis208","value":"1"}]},
          "dictionaryReferences":[],"radicals":[{"type":"classical","value":39}]}]}
        got=mod.trim(src)["学"]
        self.assertEqual(got["o"],["ガク"])
        self.assertEqual(got["k"],["まな.ぶ"])
        self.assertEqual(got["m"],["study"])
        self.assertEqual(got["s"],8)
        self.assertNotIn("v",got)
