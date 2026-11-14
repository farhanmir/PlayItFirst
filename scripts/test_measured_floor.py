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
