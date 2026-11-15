import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile


scripts = Path(__file__).parent
sys.path.insert(0, str(scripts))
spec = importlib.util.spec_from_file_location("import_costar", scripts / "import-costar.py")
import_costar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(import_costar)


class CandidateSuitesTest(unittest.TestCase):
    def test_only_active_exact_area_spaces_with_own_matching_model(self):
        base = {"id": 11, "propertyId": 101, "listingStatus": 1,
                "forLeaseSummary": {"askingRateMeasurementType": 1, "spaces": [
                    {"id": 22, "squareFeetMin": 900, "squareFeetMax": 900,
                     "rateLow": 20, "rateBasis": 2, "monetaryUnit": 1,
                     "floorPlan": {"videoExternalReferenceType": 36, "videoKey": "matched"}},
                    {"id": 23, "squareFeetMin": 900, "squareFeetMax": 1200,
                     "rateLow": 20, "rateBasis": 2, "monetaryUnit": 1,
                     "floorPlan": {"videoExternalReferenceType": 36, "videoKey": "matched"}},
                    {"id": 24, "squareFeetMin": 900, "squareFeetMax": 900,
                     "rateLow": 20, "rateBasis": 2, "monetaryUnit": 1,
                     "floorPlan": {"videoExternalReferenceType": 36, "videoKey": "unrelated"}},
                ]}}
        inactive = {**base, "id": 12, "listingStatus": 0}
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "kit.zip"
            with ZipFile(archive, "w") as kit:
                kit.writestr("commercial-properties.csv", "PropertyId,MatterportModelId,City,Address\n101,matched,Houston,10 Main St\n")
                kit.writestr("data/commercial-listing-summary.jsonl", "\n".join(map(json.dumps, [base, inactive])))
            candidates = import_costar.candidate_suites(archive, "unused")
        self.assertEqual(candidates, [{"listingId": 11, "spaceId": 22,
                                       "address": "10 Main St", "city": "Houston",
                                       "suite": "", "modelId": "matched"}])


if __name__ == "__main__":
    unittest.main()
