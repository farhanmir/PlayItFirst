import unittest
from measured_floor import convert_floor


def synthetic_model(spur=False):
    points = [(0, 0), (12, 0), (12, 12), (0, 12)]
    vertices = [{"id": str(i), "position": {"x": x, "y": y}} for i, (x, y) in enumerate(points)]
    edges = [{"id": str(i), "type": "wall", "thickness": 0.16, "vertices": [vertices[i], vertices[(i + 1) % 4]],
              "openings": [{"id": "door", "type": "doorway", "relativeCenter": 0.5, "width": 1.2, "height": 2.1}] if i == 3 else []} for i in range(4)]
    if spur:
        edges.append({"id": "spur", "type": "wall", "thickness": 0.16, "vertices": [vertices[0], {"id": "inside", "position": {"x": 1, "y": 1}}], "openings": []})
    return {"id": "synthetic", "floors": [{"id": "one", "edges": edges}], "rooms": [
        {"id": "main", "dimensionEstimates": {"area": 144}, "boundary": {"edges": [{"id": e["id"]} for e in edges]}}]}


class MeasuredFloorTests(unittest.TestCase):
    def test_preserves_model_api_handedness_and_source_metadata(self):
        model = synthetic_model()
        model["rooms"][0]["label"] = "Synthetic dining room"
        model["rooms"][0]["dimensionEstimates"].update({"height": 4.3, "lowerElevation": -1.4})
        model["floors"][0]["edges"][3]["openings"][0]["lowerElevation"] = -1.4
        plan, _, depth = convert_floor(model)
        self.assertEqual(plan["coordinateConvention"], "matterport-api-x-neg-y-v1")
        points = plan["rooms"][0]["polygon"]
        # Source API +Y must become game -Z, not a mirrored +Z floor.
        self.assertAlmostEqual(points[0]["z"], depth - 0.6)
        self.assertAlmostEqual(points[2]["z"], 0.6)
        self.assertEqual(plan["rooms"][0]["label"], "Synthetic dining room")
        self.assertEqual(plan["rooms"][0]["height"], 4.3)
        self.assertEqual(plan["walls"][3]["openings"][0]["lowerElevation"], 0)
        self.assertEqual(plan["walls"][3]["openings"][0]["sourceLowerElevation"], -1.4)
        self.assertNotIn("lowerElevation", plan["walls"][0]["openings"][0] if plan["walls"][0]["openings"] else {})

    def test_does_not_claim_absolute_source_elevation_is_a_floor_relative_sill(self):
        model = synthetic_model()
        model["floors"][0]["edges"][3]["openings"][0]["lowerElevation"] = 17.3
        plan, _, _ = convert_floor(model)
        opening = plan["walls"][3]["openings"][0]
        self.assertEqual(opening["sourceLowerElevation"], 17.3)
        self.assertNotIn("lowerElevation", opening)

    def test_accepts_only_one_unambiguous_detected_room_label(self):
        model = synthetic_model()
        model["rooms"][0]["classifications"] = [{"label": "Kitchen"}]
        plan, _, _ = convert_floor(model)
        self.assertEqual(plan["rooms"][0]["label"], "Kitchen")
        self.assertEqual(plan["rooms"][0]["labelSource"], "detected-classification")
        model["rooms"][0]["classifications"].append({"label": "Storage"})
        plan, _, _ = convert_floor(model)
        self.assertNotIn("label", plan["rooms"][0])

    def test_preserves_wall_spurs_but_orders_the_enclosing_room_boundary(self):
        plan, width, depth = convert_floor(synthetic_model(True))
        self.assertEqual(len(plan["walls"]), 5)
        self.assertEqual(len(plan["rooms"][0]["polygon"]), 4)
        self.assertAlmostEqual(width, 13.2)
        self.assertAlmostEqual(depth, 13.2)
        self.assertEqual(plan["walls"][3]["openings"][0]["center"], 0.5)
        self.assertGreater(plan["entry"]["x"], 0.6)

    def test_rejects_multifloor_models_instead_of_silently_dropping_a_floor(self):
        model = synthetic_model()
        model["floors"].append(model["floors"][0])
        with self.assertRaisesRegex(ValueError, "single captured floor"):
            convert_floor(model)

    def test_rejects_incomplete_room_boundaries(self):
        model = synthetic_model()
        model["rooms"][0]["boundary"]["edges"].pop()
        with self.assertRaisesRegex(ValueError, "boundary"):
            convert_floor(model)


if __name__ == "__main__":
    unittest.main()
