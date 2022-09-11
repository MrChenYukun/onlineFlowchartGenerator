#include <iostream>
using namespace std;
int main() {
  int a = 1;
  cout << "Hello this is the entrance of program" << endl;

  if (a == 1) {
    cout << "If a equal to 1, show this message" << endl;
  } else {
    cout << "If a equal to 0, show this message" << endl;
  }

  cout << "Test While struct" << endl;

  while (a > 0) {
    cout << "A is decreased by 1" << endl;
    a--;
  }

  cout << "Test Do-While structure" << endl;

  do {
    cout << "A is plused by 1" << endl;
    a++;
  } while (a < 2);

  cout << "This is the end of program" << endl;

  return 0;
}