#include <fstream>
#include <iostream>
#include <string>
#include <vector>

using namespace std;

int main() {
  char buffer[256];
  vector<string> code;
  vector<string> code_out;
  ifstream in("testcode\\test1.cpp");
  ofstream out("dumpedcode.txt");

  if (!in.is_open()) {
    cout << "Error reading test code" << endl;
  } else {
    while (!in.eof()) {
      in.getline(buffer, 255);
      code.push_back((string)buffer);
    }
  }

  int counter = 0;
  string str;

  for (int i = 0; i < code.size(); i++) {
    for (int j = 0; j < code[i].length(); j++) {
      if (code[i][j] != ';' && code[i][j] != '{') {
        str += code[i][j];
      } else {
        cout << counter++ << ": " << str << endl;
        code_out.push_back(str);
        str.clear();
      }
    }
  }

  cout << code_out.size() << endl;

  out << "s=>start: Start" << endl;
  out << "e=>end: End" << endl;

  for (int i = 2; i < code_out.size(); i++) {
    out << "op" << i - 2 << "=>operation: " << code_out[i] << endl;
  }

  out << endl;

  out << "s->";

  for (int i = 0; i < code_out.size() - 2; i++) {
    out << "op" << i << "->";
  }
  out << "e" << endl;
  return 0;
}