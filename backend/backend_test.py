"""
Comprehensive backend API tests for VRoid Companion Studio
Tests all endpoints: health, generation (texture/concept/variant/turnaround), projects CRUD, assets, VRM upload
"""
import requests
import sys
import time
import json
from datetime import datetime

# Use the public endpoint from frontend/.env
BASE_URL = "https://model-texture-craft.preview.emergentagent.com/api"

class VRoidAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_project_id = None
        self.created_asset_ids = []
        
    def log_result(self, test_name, passed, status_code=None, message="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ PASS: {test_name}")
            if message:
                print(f"   {message}")
        else:
            print(f"❌ FAIL: {test_name}")
            if status_code:
                print(f"   Status: {status_code}")
            if message:
                print(f"   {message}")
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "status_code": status_code,
            "message": message,
            "response_data": response_data
        })
        
    def test_health(self):
        """Test GET /api/ health endpoint"""
        print("\n🔍 Testing Health Endpoint...")
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "ok":
                    self.log_result("Health Check", True, 200, f"Response: {data}")
                    return True
                else:
                    self.log_result("Health Check", False, 200, f"Unexpected response: {data}")
            else:
                self.log_result("Health Check", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("Health Check", False, message=f"Exception: {str(e)}")
        return False
    
    def test_create_project(self):
        """Test POST /api/projects"""
        print("\n🔍 Testing Create Project...")
        try:
            payload = {
                "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
                "description": "Automated test project"
            }
            response = requests.post(f"{self.base_url}/projects", json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "name" in data:
                    self.created_project_id = data["id"]
                    self.log_result("Create Project", True, 200, f"Created project ID: {self.created_project_id}")
                    return True
                else:
                    self.log_result("Create Project", False, 200, f"Missing fields in response: {data}")
            else:
                self.log_result("Create Project", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("Create Project", False, message=f"Exception: {str(e)}")
        return False
    
    def test_get_project(self):
        """Test GET /api/projects/{id}"""
        if not self.created_project_id:
            self.log_result("Get Project", False, message="No project ID available (create failed)")
            return False
        
        print("\n🔍 Testing Get Project...")
        try:
            response = requests.get(f"{self.base_url}/projects/{self.created_project_id}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("id") == self.created_project_id:
                    self.log_result("Get Project", True, 200, f"Retrieved project: {data.get('name')}")
                    return True
                else:
                    self.log_result("Get Project", False, 200, f"ID mismatch: {data}")
            else:
                self.log_result("Get Project", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("Get Project", False, message=f"Exception: {str(e)}")
        return False
    
    def test_list_projects(self):
        """Test GET /api/projects"""
        print("\n🔍 Testing List Projects...")
        try:
            response = requests.get(f"{self.base_url}/projects", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "projects" in data and isinstance(data["projects"], list):
                    self.log_result("List Projects", True, 200, f"Found {len(data['projects'])} projects")
                    return True
                else:
                    self.log_result("List Projects", False, 200, f"Unexpected response format: {data}")
            else:
                self.log_result("List Projects", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("List Projects", False, message=f"Exception: {str(e)}")
        return False
    
    def test_update_project(self):
        """Test PATCH /api/projects/{id}"""
        if not self.created_project_id:
            self.log_result("Update Project", False, message="No project ID available")
            return False
        
        print("\n🔍 Testing Update Project...")
        try:
            payload = {"description": "Updated description via test"}
            response = requests.patch(f"{self.base_url}/projects/{self.created_project_id}", json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("description") == payload["description"]:
                    self.log_result("Update Project", True, 200, "Project updated successfully")
                    return True
                else:
                    self.log_result("Update Project", False, 200, f"Update not reflected: {data}")
            else:
                self.log_result("Update Project", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("Update Project", False, message=f"Exception: {str(e)}")
        return False
    
    def test_generate_texture(self):
        """Test POST /api/generate/texture (takes ~8-30s)"""
        print("\n🔍 Testing Generate Texture (may take 30-60s)...")
        try:
            payload = {
                "prompt": "pastel pink sailor uniform with cherry blossom pattern",
                "kind": "texture",
                "project_id": self.created_project_id
            }
            response = requests.post(f"{self.base_url}/generate/texture", json=payload, timeout=90)
            if response.status_code == 200:
                data = response.json()
                if "asset" in data and "data_url" in data["asset"]:
                    asset_id = data["asset"].get("id")
                    if asset_id:
                        self.created_asset_ids.append(asset_id)
                    self.log_result("Generate Texture", True, 200, f"Generated texture asset ID: {asset_id}")
                    return True
                else:
                    self.log_result("Generate Texture", False, 200, f"Missing asset data: {data}")
            else:
                self.log_result("Generate Texture", False, response.status_code, response.text[:300])
        except requests.exceptions.Timeout:
            self.log_result("Generate Texture", False, message="Request timed out (>90s)")
        except Exception as e:
            self.log_result("Generate Texture", False, message=f"Exception: {str(e)}")
        return False
    
    def test_generate_concept(self):
        """Test POST /api/generate/concept (takes ~8-30s)"""
        print("\n🔍 Testing Generate Concept (may take 30-60s)...")
        try:
            payload = {
                "prompt": "a cheerful anime girl with blue hair and school uniform",
                "project_id": self.created_project_id
            }
            response = requests.post(f"{self.base_url}/generate/concept", json=payload, timeout=90)
            if response.status_code == 200:
                data = response.json()
                if "asset" in data and "data_url" in data["asset"]:
                    asset_id = data["asset"].get("id")
                    if asset_id:
                        self.created_asset_ids.append(asset_id)
                    # Store for variant test
                    self.concept_data_url = data["asset"].get("data_url")
                    self.log_result("Generate Concept", True, 200, f"Generated concept asset ID: {asset_id}")
                    return True
                else:
                    self.log_result("Generate Concept", False, 200, f"Missing asset data: {data}")
            else:
                self.log_result("Generate Concept", False, response.status_code, response.text[:300])
        except requests.exceptions.Timeout:
            self.log_result("Generate Concept", False, message="Request timed out (>90s)")
        except Exception as e:
            self.log_result("Generate Concept", False, message=f"Exception: {str(e)}")
        return False
    
    def test_generate_variant(self):
        """Test POST /api/generate/variant (needs reference)"""
        if not hasattr(self, 'concept_data_url'):
            self.log_result("Generate Variant", False, message="No concept data_url available (concept generation failed)")
            return False
        
        print("\n🔍 Testing Generate Variant (may take 30-60s)...")
        try:
            payload = {
                "prompt": "same character but with red hair instead",
                "reference_data_url": self.concept_data_url,
                "project_id": self.created_project_id
            }
            response = requests.post(f"{self.base_url}/generate/variant", json=payload, timeout=90)
            if response.status_code == 200:
                data = response.json()
                if "asset" in data and "data_url" in data["asset"]:
                    asset_id = data["asset"].get("id")
                    if asset_id:
                        self.created_asset_ids.append(asset_id)
                    self.log_result("Generate Variant", True, 200, f"Generated variant asset ID: {asset_id}")
                    return True
                else:
                    self.log_result("Generate Variant", False, 200, f"Missing asset data: {data}")
            else:
                self.log_result("Generate Variant", False, response.status_code, response.text[:300])
        except requests.exceptions.Timeout:
            self.log_result("Generate Variant", False, message="Request timed out (>90s)")
        except Exception as e:
            self.log_result("Generate Variant", False, message=f"Exception: {str(e)}")
        return False
    
    def test_generate_turnaround(self):
        """Test POST /api/generate/turnaround (takes ~60-90s, generates 4 panels)"""
        print("\n🔍 Testing Generate Turnaround (may take 60-120s for 4 panels)...")
        try:
            payload = {
                "character_desc": "anime girl with long purple hair and magical girl outfit",
                "project_id": self.created_project_id
            }
            response = requests.post(f"{self.base_url}/generate/turnaround", json=payload, timeout=150)
            if response.status_code == 200:
                data = response.json()
                if "panels" in data and isinstance(data["panels"], list):
                    panel_count = len(data["panels"])
                    success_count = sum(1 for p in data["panels"] if "asset" in p)
                    if success_count >= 3:  # At least 3 out of 4 panels
                        for panel in data["panels"]:
                            if "asset" in panel:
                                asset_id = panel["asset"].get("id")
                                if asset_id:
                                    self.created_asset_ids.append(asset_id)
                        self.log_result("Generate Turnaround", True, 200, 
                                      f"Generated {success_count}/{panel_count} turnaround panels")
                        return True
                    else:
                        self.log_result("Generate Turnaround", False, 200, 
                                      f"Only {success_count}/{panel_count} panels succeeded")
                else:
                    self.log_result("Generate Turnaround", False, 200, f"Missing panels data: {data}")
            else:
                self.log_result("Generate Turnaround", False, response.status_code, response.text[:300])
        except requests.exceptions.Timeout:
            self.log_result("Generate Turnaround", False, message="Request timed out (>150s)")
        except Exception as e:
            self.log_result("Generate Turnaround", False, message=f"Exception: {str(e)}")
        return False
    
    def test_list_assets(self):
        """Test GET /api/assets"""
        print("\n🔍 Testing List Assets...")
        try:
            response = requests.get(f"{self.base_url}/assets", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "assets" in data and isinstance(data["assets"], list):
                    self.log_result("List Assets", True, 200, f"Found {len(data['assets'])} assets")
                    return True
                else:
                    self.log_result("List Assets", False, 200, f"Unexpected response format: {data}")
            else:
                self.log_result("List Assets", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("List Assets", False, message=f"Exception: {str(e)}")
        return False
    
    def test_delete_asset(self):
        """Test DELETE /api/assets/{id}"""
        if not self.created_asset_ids:
            self.log_result("Delete Asset", False, message="No asset IDs available")
            return False
        
        print("\n🔍 Testing Delete Asset...")
        try:
            asset_id = self.created_asset_ids[0]
            response = requests.delete(f"{self.base_url}/assets/{asset_id}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("deleted", 0) > 0:
                    self.log_result("Delete Asset", True, 200, f"Deleted asset {asset_id}")
                    return True
                else:
                    self.log_result("Delete Asset", False, 200, f"Asset not deleted: {data}")
            else:
                self.log_result("Delete Asset", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("Delete Asset", False, message=f"Exception: {str(e)}")
        return False
    
    def test_vrm_upload_validation(self):
        """Test VRM upload endpoint validation (without actual VRM file)"""
        if not self.created_project_id:
            self.log_result("VRM Upload Validation", False, message="No project ID available")
            return False
        
        print("\n🔍 Testing VRM Upload Validation...")
        try:
            # Test with non-VRM file to check validation
            files = {'file': ('test.txt', b'not a vrm file', 'text/plain')}
            response = requests.post(
                f"{self.base_url}/projects/{self.created_project_id}/vrm",
                files=files,
                timeout=10
            )
            # Should return 400 for non-VRM file
            if response.status_code == 400:
                self.log_result("VRM Upload Validation", True, 400, "Correctly rejected non-VRM file")
                return True
            else:
                self.log_result("VRM Upload Validation", False, response.status_code, 
                              f"Expected 400 for non-VRM, got {response.status_code}")
        except Exception as e:
            self.log_result("VRM Upload Validation", False, message=f"Exception: {str(e)}")
        return False
    
    def test_delete_project(self):
        """Test DELETE /api/projects/{id} - run last to cleanup"""
        if not self.created_project_id:
            self.log_result("Delete Project", False, message="No project ID available")
            return False
        
        print("\n🔍 Testing Delete Project...")
        try:
            response = requests.delete(f"{self.base_url}/projects/{self.created_project_id}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("deleted"):
                    self.log_result("Delete Project", True, 200, f"Deleted project {self.created_project_id}")
                    return True
                else:
                    self.log_result("Delete Project", False, 200, f"Project not deleted: {data}")
            else:
                self.log_result("Delete Project", False, response.status_code, response.text[:200])
        except Exception as e:
            self.log_result("Delete Project", False, message=f"Exception: {str(e)}")
        return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("VRoid Companion Studio - Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        # Basic tests
        self.test_health()
        
        # Project CRUD
        self.test_create_project()
        self.test_get_project()
        self.test_list_projects()
        self.test_update_project()
        
        # Generation tests (these take time)
        self.test_generate_texture()
        self.test_generate_concept()
        self.test_generate_variant()
        self.test_generate_turnaround()
        
        # Assets
        self.test_list_assets()
        self.test_delete_asset()
        
        # VRM
        self.test_vrm_upload_validation()
        
        # Cleanup
        self.test_delete_project()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        print("=" * 80)
        
        return self.tests_passed, self.tests_run, self.test_results

def main():
    tester = VRoidAPITester()
    passed, total, results = tester.run_all_tests()
    
    # Save results to JSON
    results_file = "/app/backend/test_results.json"
    with open(results_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "passed": passed,
            "total": total,
            "success_rate": f"{(passed/total*100):.1f}%",
            "results": results
        }, f, indent=2)
    print(f"\n📄 Detailed results saved to: {results_file}")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
